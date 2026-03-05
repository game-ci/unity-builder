import * as core from '@actions/core';
import { Action, BuildParameters, Cache, Orchestrator, Docker, ImageTag, Output } from './model';
import { Cli } from './model/cli/cli';
import MacBuilder from './model/mac-builder';
import PlatformSetup from './model/platform-setup';
import { BuildReliabilityService } from './model/orchestrator/services/reliability';

async function runMain() {
  try {
    if (Cli.InitCliMode()) {
      await Cli.RunCli();

      return;
    }
    Action.checkCompatibility();
    Cache.verify();

    // Always configure git environment for CI reliability
    BuildReliabilityService.configureGitEnvironment();

    const { workspace, actionFolder } = Action;

    const buildParameters = await BuildParameters.create();
    const baseImage = new ImageTag(buildParameters);

    // Pre-build reliability checks
    if (buildParameters.gitIntegrityCheck) {
      core.info('Running git integrity checks...');

      const isHealthy = BuildReliabilityService.checkGitIntegrity(workspace);
      BuildReliabilityService.cleanStaleLockFiles(workspace);
      BuildReliabilityService.validateSubmoduleBackingStores(workspace);

      if (buildParameters.cleanReservedFilenames) {
        BuildReliabilityService.cleanReservedFilenames(buildParameters.projectPath);
      }

      if (!isHealthy && buildParameters.gitAutoRecover) {
        core.info('Git corruption detected, attempting automatic recovery...');
        const recovered = BuildReliabilityService.recoverCorruptedRepo(workspace);
        if (!recovered) {
          core.warning('Automatic recovery failed. Build may encounter issues.');
        }
      }
    } else if (buildParameters.cleanReservedFilenames) {
      // cleanReservedFilenames can run independently of gitIntegrityCheck
      BuildReliabilityService.cleanReservedFilenames(buildParameters.projectPath);
    }

    let exitCode = -1;

    if (buildParameters.providerStrategy === 'local') {
      core.info('Building locally');
      await PlatformSetup.setup(buildParameters, actionFolder);
      exitCode =
        process.platform === 'darwin'
          ? await MacBuilder.run(actionFolder)
          : await Docker.run(baseImage.toString(), {
              workspace,
              actionFolder,
              ...buildParameters,
            });
    } else {
      await Orchestrator.run(buildParameters, baseImage.toString());
      exitCode = 0;
    }

    // Post-build: archive and enforce retention
    if (buildParameters.buildArchiveEnabled && exitCode === 0) {
      core.info('Archiving build output...');
      BuildReliabilityService.archiveBuildOutput(buildParameters.buildPath, buildParameters.buildArchivePath);
      BuildReliabilityService.enforceRetention(buildParameters.buildArchivePath, buildParameters.buildArchiveRetention);
    }

    // Set output
    await Output.setBuildVersion(buildParameters.buildVersion);
    await Output.setAndroidVersionCode(buildParameters.androidVersionCode);
    await Output.setEngineExitCode(exitCode);

    if (exitCode !== 0) {
      core.setFailed(`Build failed with exit code ${exitCode}`);
    }
  } catch (error) {
    core.setFailed((error as Error).message);
  }
}

runMain();
