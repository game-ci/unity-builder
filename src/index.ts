import * as core from '@actions/core';
import { Action, BuildParameters, Cache, Docker, ImageTag, Output } from './model';
import { Cli } from './model/cli/cli';
import MacBuilder from './model/mac-builder';
import PlatformSetup from './model/platform-setup';
import { loadOrchestratorPlugin, OrchestratorPlugin } from './model/orchestrator-plugin';

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

    // Load orchestrator plugin (optional — only needed for remote builds and plugin features)
    const plugin = await loadOrchestratorPlugin();
    await plugin?.initialize(buildParameters, workspace);

    let exitCode = -1;

    if (plugin?.canHandleBuild()) {
      // Plugin handles the build entirely (remote providers, hot runner, test workflows)
      const result = await plugin.handleBuild(baseImage.toString());

      exitCode = result.fallbackToLocal
        ? await runLocalBuild(buildParameters, baseImage, workspace, actionFolder, plugin)
        : result.exitCode;
    } else if (buildParameters.providerStrategy === 'local') {
      exitCode = await runLocalBuild(buildParameters, baseImage, workspace, actionFolder, plugin);
    } else {
      throw new Error(
        `Provider strategy "${buildParameters.providerStrategy}" requires @game-ci/orchestrator. ` +
          'Install it via the game-ci/orchestrator action, or use providerStrategy=local.',
      );
    }

    // Set core outputs
    await Output.setBuildVersion(buildParameters.buildVersion);
    await Output.setAndroidVersionCode(buildParameters.androidVersionCode);
    await Output.setEngineExitCode(exitCode);

    // Plugin handles post-build (artifacts, archiving, retention)
    await plugin?.handlePostBuild(exitCode);

    if (exitCode !== 0) {
      core.setFailed(`Build failed with exit code ${exitCode}`);
    }
  } catch (error) {
    core.setFailed((error as Error).message);
  }
}

async function runLocalBuild(
  buildParameters: BuildParameters,
  baseImage: ImageTag,
  workspace: string,
  actionFolder: string,
  plugin?: OrchestratorPlugin,
): Promise<number> {
  await plugin?.beforeLocalBuild(workspace);

  await PlatformSetup.setup(buildParameters, actionFolder);
  const exitCode =
    process.platform === 'darwin'
      ? await MacBuilder.run(actionFolder)
      : await Docker.run(baseImage.toString(), {
          workspace,
          actionFolder,
          ...buildParameters,
        });

  await plugin?.afterLocalBuild(workspace, exitCode);

  return exitCode;
}

runMain();
