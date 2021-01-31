import { Action, BuildParameters, Cache, Docker, ImageTag, Kubernetes, Output } from './model';

const core = require('@actions/core');

async function action() {
  Action.checkCompatibility();
  Cache.verify();

  const { dockerfile, workspace, actionFolder } = Action;

  const buildParameters = await BuildParameters.create();
  const baseImage = new ImageTag(buildParameters);
  let builtImage;

  switch (buildParameters.remote) {
    case 'k8s':
      core.info('Building with Kubernetes');
      await Kubernetes.runBuildJob(buildParameters, baseImage);
      break;

    case 'aws':
      break;

    // default and local case
    default:
      // Build docker image
      // TODO: No image required (instead use a version published to dockerhub for the action, supply credentials for github cloning)
      builtImage = await Docker.build({ path: actionFolder, dockerfile, baseImage });
      await Docker.run(builtImage, { workspace, ...buildParameters });
      break;
  }

  // Set output
  await Output.setBuildVersion(buildParameters.buildVersion);
}

action().catch((error) => {
  core.setFailed(error.message);
});
