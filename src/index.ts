import * as core from '@actions/core';
import { Action, BuildParameters, Cache, Docker, ImageTag, Output, CloudRunner } from './model';
import { CLI } from './model/cli/cli';
import CloudRunnerLogger from './model/cloud-runner/services/cloud-runner-logger';
async function runMain() {
  try {
    Action.checkCompatibility();
    Cache.verify();

    const { dockerfile, workspace, actionFolder } = Action;

    const buildParameters = await BuildParameters.create();
    const baseImage = new ImageTag(buildParameters);
    if (
      buildParameters.cloudRunnerCluster &&
      buildParameters.cloudRunnerCluster !== '' &&
      buildParameters.cloudRunnerCluster !== 'local'
    ) {
      await CloudRunner.run(buildParameters, baseImage.toString());
    } else {
      core.info('Building locally');
      const builtImage = await Docker.build({ path: actionFolder, dockerfile, baseImage });
      await Docker.run(builtImage, { workspace, ...buildParameters });
    }

    // Set output
    await Output.setBuildVersion(buildParameters.buildVersion);
  } catch (error) {
    core.setFailed((error as Error).message);
  }
}
CloudRunnerLogger.InitHook();
const options = CLI.SetupCli();
if (CLI.isCliMode(options)) {
  CLI.RunCli(options);
} else {
  runMain();
}
