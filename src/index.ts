import * as core from '@actions/core';
import { Action, BuildParameters, Cache, CloudRunner, Docker, ImageTag, Output } from './model';
import { Cli } from './model/cli/cli';
import MacBuilder from './model/mac-builder';
import PlatformSetup from './model/platform-setup';

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

    if (buildParameters.providerStrategy === 'local') {
      core.info('Building locally');
      await PlatformSetup.setup(buildParameters, actionFolder);
      if (process.platform === 'darwin') {
        MacBuilder.run(actionFolder);
      } else {
        await Docker.run(baseImage.toString(), { workspace, actionFolder, ...buildParameters });
      }
    } else {
      await CloudRunner.run(buildParameters, baseImage.toString());
    }

    // Set output
    await Output.setBuildVersion(buildParameters.buildVersion);
    await Output.setAndroidVersionCode(buildParameters.androidVersionCode);
  } catch (error) {
    core.setFailed((error as Error).message);
  }
}
runMain();
