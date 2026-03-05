import * as core from '@actions/core';
import path from 'node:path';
import { Action, BuildParameters, Cache, Orchestrator, Docker, ImageTag, Output } from './model';
import { Cli } from './model/cli/cli';
import MacBuilder from './model/mac-builder';
import PlatformSetup from './model/platform-setup';
import { TestWorkflowService } from './model/orchestrator/services/test-workflow';
import { HotRunnerService } from './model/orchestrator/services/hot-runner';
import { HotRunnerConfig } from './model/orchestrator/services/hot-runner/hot-runner-types';
import { OutputService } from './model/orchestrator/services/output/output-service';
import { OutputTypeRegistry } from './model/orchestrator/services/output/output-type-registry';
import { ArtifactUploadHandler } from './model/orchestrator/services/output/artifact-upload-handler';

async function runMain() {
  try {
    if (Cli.InitCliMode()) {
      await Cli.RunCli();

      return;
    }
    Action.checkCompatibility();
    Cache.verify();

    const { workspace, actionFolder } = Action;

    const buildParameters = await BuildParameters.create();

    // If a test suite path is provided, use the test workflow engine
    // instead of the standard build execution path
    if (buildParameters.testSuitePath) {
      core.info('[TestWorkflow] Test suite path detected, using test workflow engine');
      const results = await TestWorkflowService.executeTestSuite(buildParameters.testSuitePath, buildParameters);

      const totalFailed = results.reduce((sum, r) => sum + r.failed, 0);
      if (totalFailed > 0) {
        core.setFailed(`Test workflow completed with ${totalFailed} failure(s)`);
      } else {
        core.info('[TestWorkflow] All test runs passed');
      }

      return;
    }

    const baseImage = new ImageTag(buildParameters);

    let exitCode = -1;

    // Hot runner path: attempt to use a persistent Unity editor instance
    if (buildParameters.hotRunnerEnabled) {
      core.info('[HotRunner] Hot runner mode enabled, attempting hot build...');

      const hotRunnerConfig: HotRunnerConfig = {
        enabled: true,
        transport: buildParameters.hotRunnerTransport,
        host: buildParameters.hotRunnerHost,
        port: buildParameters.hotRunnerPort,
        healthCheckInterval: buildParameters.hotRunnerHealthInterval,
        maxIdleTime: buildParameters.hotRunnerMaxIdle,
        maxJobsBeforeRecycle: 0, // no automatic recycle by job count
      };

      const hotRunnerService = new HotRunnerService();

      try {
        await hotRunnerService.initialize(hotRunnerConfig);
        const result = await hotRunnerService.submitBuild(buildParameters, (output) => {
          core.info(output);
        });

        exitCode = result.exitCode;
        core.info(`[HotRunner] Build completed with exit code ${exitCode}`);
        await hotRunnerService.shutdown();
      } catch (hotRunnerError) {
        await hotRunnerService.shutdown();

        if (buildParameters.hotRunnerFallbackToCold) {
          core.warning(
            `[HotRunner] Hot runner failed: ${(hotRunnerError as Error).message}. Falling back to cold build.`,
          );
          exitCode = await runColdBuild(buildParameters, baseImage, workspace, actionFolder);
        } else {
          throw hotRunnerError;
        }
      }
    } else if (buildParameters.providerStrategy === 'local') {
      core.info('Building locally');
      exitCode = await runColdBuild(buildParameters, baseImage, workspace, actionFolder);
    } else {
      await Orchestrator.run(buildParameters, baseImage.toString());
      exitCode = 0;
    }

    // Set output
    await Output.setBuildVersion(buildParameters.buildVersion);
    await Output.setAndroidVersionCode(buildParameters.androidVersionCode);
    await Output.setEngineExitCode(exitCode);

    // Artifact collection and upload (runs on both success and failure)
    try {
      // Register custom output types if provided
      if (buildParameters.artifactCustomTypes) {
        try {
          const customTypes = JSON.parse(buildParameters.artifactCustomTypes);
          if (Array.isArray(customTypes)) {
            for (const ct of customTypes) {
              OutputTypeRegistry.registerType({
                name: ct.name,
                defaultPath: ct.defaultPath || ct.pattern || `./${ct.name}/`,
                description: ct.description || `Custom output type: ${ct.name}`,
                builtIn: false,
              });
            }
          }
        } catch (parseError) {
          core.warning(`Failed to parse artifactCustomTypes: ${(parseError as Error).message}`);
        }
      }

      // Collect outputs and generate manifest
      const manifestPath = path.join(buildParameters.projectPath, 'output-manifest.json');
      const manifest = await OutputService.collectOutputs(
        buildParameters.projectPath,
        buildParameters.buildGuid,
        buildParameters.artifactOutputTypes,
        manifestPath,
      );

      core.setOutput('artifactManifestPath', manifestPath);

      // Upload artifacts
      const uploadConfig = ArtifactUploadHandler.parseConfig(
        buildParameters.artifactUploadTarget,
        buildParameters.artifactUploadPath || undefined,
        buildParameters.artifactCompression,
        buildParameters.artifactRetentionDays,
      );

      const uploadResult = await ArtifactUploadHandler.uploadArtifacts(
        manifest,
        uploadConfig,
        buildParameters.projectPath,
      );

      if (!uploadResult.success) {
        core.warning(
          `Artifact upload completed with errors: ${uploadResult.entries
            .filter((e) => !e.success)
            .map((e) => `${e.type}: ${e.error}`)
            .join('; ')}`,
        );
      }
    } catch (artifactError) {
      core.warning(`Artifact collection/upload failed: ${(artifactError as Error).message}`);
    }

    if (exitCode !== 0) {
      core.setFailed(`Build failed with exit code ${exitCode}`);
    }
  } catch (error) {
    core.setFailed((error as Error).message);
  }
}

async function runColdBuild(
  buildParameters: BuildParameters,
  baseImage: ImageTag,
  workspace: string,
  actionFolder: string,
): Promise<number> {
  if (buildParameters.providerStrategy === 'local') {
    core.info('Building locally');
    await PlatformSetup.setup(buildParameters, actionFolder);

    return process.platform === 'darwin'
      ? await MacBuilder.run(actionFolder)
      : await Docker.run(baseImage.toString(), {
          workspace,
          actionFolder,
          ...buildParameters,
        });
  } else {
    await Orchestrator.run(buildParameters, baseImage.toString());

    return 0;
  }
}

runMain();
