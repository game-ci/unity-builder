import * as core from '../node_modules/@actions/core';
import { Action, BuildParameters, Cache, CloudRunner, Docker, ImageTag, Output } from './model.ts';
import { Cli } from './model/cli/cli.ts';
import MacBuilder from './model/mac-builder.ts';
import PlatformSetup from './model/platform-setup.ts';

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

    if (buildParameters.cloudRunnerCluster !== 'local') {
      await CloudRunner.run(buildParameters, baseImage.toString());
    } else {
      core.info('Building locally');
      await PlatformSetup.setup(buildParameters, actionFolder);
      if (process.platform === 'darwin') {
        MacBuilder.run(actionFolder, workspace, buildParameters);
      } else {
        await Docker.run(baseImage, { workspace, actionFolder, ...buildParameters });
      }
    }

    // Set output
    await Output.setBuildVersion(buildParameters.buildVersion);
  } catch (error) {
    core.setFailed((error as Error).message);
  }
}

runMain();
