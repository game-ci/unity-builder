import * as core from '@actions/core';
import { Action, BuildParameters, Cache, Docker, ImageTag, Kubernetes, Output, AWS } from './model';

async function run() {
  try {
    Action.checkCompatibility();
    Cache.verify();

    const { dockerfile, workspace, actionFolder } = Action;

    const buildParameters = await BuildParameters.create();
    const baseImage = new ImageTag(buildParameters);
    let builtImage;

    switch (buildParameters.remoteBuildCluster) {
      case 'k8s':
        core.info('Building with Kubernetes');
        await Kubernetes.runBuildJob(buildParameters, baseImage);
        break;

      case 'aws':
        core.info('Building with AWS');
        await AWS.runBuildJob(buildParameters, baseImage);
        break;

      // default and local case
      default:
        core.info('Building locally');
        builtImage = await Docker.build({ path: actionFolder, dockerfile, baseImage });
        await Docker.run(builtImage, { workspace, ...buildParameters });
        break;
    }

    // Set output
    await Output.setBuildVersion(buildParameters.buildVersion);
  } catch (error) {
    core.setFailed(error.message);
  }
}

run();
