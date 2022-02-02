import * as core from '@actions/core';
import { Action, BuildParameters, Cache, Docker, ImageTag, Output, CloudRunner } from './model';
import { CLI } from './model/cli/cli';
import MacBuilder from './model/mac-builder';
import PlatformSetup from './model/platform-setup';
async function runMain() {
  try {
    Action.checkCompatibility();
    Cache.verify();

    const { dockerfile, workspace, actionFolder } = Action;

    const buildParameters = await BuildParameters.create();
    const baseImage = new ImageTag(buildParameters);

    let builtImage;

    if (
      buildParameters.cloudRunnerCluster &&
      buildParameters.cloudRunnerCluster !== '' &&
      buildParameters.cloudRunnerCluster !== 'local'
    ) {
      await CloudRunner.run(buildParameters, baseImage.toString());
    } else {
      core.info('Building locally');
      await PlatformSetup.setup(buildParameters, actionFolder);
      if (process.platform === 'darwin') {
        MacBuilder.run(actionFolder, workspace, buildParameters);
      } else {
        builtImage = await Docker.build({ path: actionFolder, dockerfile, baseImage });
        await Docker.run(builtImage, { workspace, ...buildParameters });
      }
    }

    // Set output
    await Output.setBuildVersion(buildParameters.buildVersion);
  } catch (error) {
    core.setFailed((error as Error).message);
  }
}
const options = CLI.SetupCli();
if (CLI.isCliMode(options)) {
  CLI.RunCli(options);
} else {
  runMain();
}
