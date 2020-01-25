import { Action, Docker, Input, ImageTag, BuildParameters, Cache } from './model';

const core = require('@actions/core');

async function action() {
  Action.checkCompatibility();

  // Load cache
  await Cache.load();

  const { dockerfile, workspace, builderFolder } = Action;
  const buildParameters = BuildParameters.create(Input.getFromUser());
  const baseImage = new ImageTag(buildParameters);

  // Build docker image
  const builtImage = await Docker.build({ path: builderFolder, dockerfile, baseImage });

  // Run docker image
  await Docker.run(builtImage, { workspace, ...buildParameters });

  // Save cache
  await Cache.save();
}

action().catch(error => {
  core.setFailed(error.message);
});
