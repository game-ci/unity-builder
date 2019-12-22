import Action from './model/action';
import Docker from './model/docker';
import ImageTag from './model/image';
import Input from './model/input';

const core = require('@actions/core');

async function action() {
  Action.checkCompatibility();

  const {
    unityVersion,
    targetPlatform,
    projectPath,
    buildName,
    buildsPath,
    buildMethod,
  } = Input.getFromUser();

  const { dockerfile, workspace } = Action;
  const baseImage = new ImageTag({ unityVersion, targetPlatform });
  const builtImage = await Docker.build({ path: workspace, dockerfile, image: baseImage });
  await Docker.run(builtImage, { projectPath, buildName, buildsPath, buildMethod });
}

action().catch(error => {
  core.setFailed(error.message);
});
