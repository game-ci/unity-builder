import { Action, Docker, Input, ImageTag, BuildParameters } from './model';

const core = require('@actions/core');

async function action() {
  Action.checkCompatibility();

  const { dockerfile, workspace, builderFolder } = Action;
  const buildParameters = BuildParameters.create(Input.getFromUser());
  const baseImage = new ImageTag(buildParameters);

  // Build docker image
  const builtImage = await Docker.build({ path: builderFolder, dockerfile, baseImage });

  // Run docker image
  await Docker.run(builtImage, { workspace, ...buildParameters });
}

action().catch(error => {
  core.setFailed(error.message);
});
