import { Action, BuildParameters, Cache, Docker, ImageTag } from './model';

const core = require('@actions/core');

async function action() {
  Action.checkCompatibility();
  Cache.verify();

  const { dockerfile, workspace, actionFolder } = Action;

  const buildParameters = await BuildParameters.create();
  const baseImage = new ImageTag(buildParameters);

  // Build docker image
  const builtImage = await Docker.build({ path: actionFolder, dockerfile, baseImage });

  // Run docker image
  await Docker.run(builtImage, { workspace, ...buildParameters });
}

action().catch((error) => {
  core.setFailed(error.message);
});
