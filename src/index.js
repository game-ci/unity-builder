const core = require('@actions/core');
const path = require('path');
const { exec } = require('@actions/exec');

async function action() {
  // Explicitly notify about platform support
  if (process.platform !== 'linux') {
    throw new Error('Currently only Linux-based platforms are supported');
  }

  // Input variables specified in workflows using "with" prop.
  const projectPath = core.getInput('projectPath', { default: './' });
  const targetPlatform = core.getInput('targetPlatform', { default: 'WebGL' });
  const unityVersion = core.getInput('unityVersion', { default: '2019.2.11f1' });
  const buildName = core.getInput('buildName', { default: 'TestBuild' });
  const buildsPath = core.getInput('buildsPath', { default: 'build' });
  const buildMethod = core.getInput('buildMethod', { default: '' });

  // Determine image
  const IMAGE_UNITY_VERSION = unityVersion;
  const IMAGE_TARGET_PLATFORM = targetPlatform.toLowerCase();

  // Run appropriate docker image with given args
  const bootstrapper = path.join(__dirname, 'run-unity-builder.sh');
  await exec(`ls ${bootstrapper}`);
  await exec(`chmod +x ${bootstrapper}`);
  await exec(bootstrapper, [
    IMAGE_UNITY_VERSION,
    IMAGE_TARGET_PLATFORM,
    projectPath,
    targetPlatform,
    buildName,
    buildsPath,
    buildMethod,
  ]);
}

action().catch(error => {
  core.setFailed(error.message);
});
