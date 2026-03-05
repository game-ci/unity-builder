import * as core from '@actions/core';
import path from 'node:path';
import { Action, BuildParameters, Cache, Orchestrator, Docker, ImageTag, Output } from './model';
import { Cli } from './model/cli/cli';
import MacBuilder from './model/mac-builder';
import PlatformSetup from './model/platform-setup';
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
    const baseImage = new ImageTag(buildParameters);

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

runMain();
