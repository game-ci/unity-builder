const core = require('@actions/core');
const path = require('path');
const { exec } = require('@actions/exec');

async function action() {
  // Path to the project to open with Unity
  const projectPath = core.getInput('projectPath', {
    required: false,
    default: './',
  });

  // Target platform for the build
  const buildTarget = core.getInput('buildTarget', {
    required: false,
    default: 'WebGL',
  });

  // Name of the build
  const buildName = core.getInput('buildName', {
    required: false,
    default: 'TestBuild',
  });

  // Path where build will be stored
  const buildsPath = core.getInput('buildsPath', {
    required: false,
    default: 'build',
  });

  // Method to execute within unity. Must be static
  const buildMethod = core.getInput('buildMethod', {
    required: false,
    default: '',
  });

  // Run appropriate docker image with given args
  await exec(path.join(__dirname, 'run-unity-builder.sh'), [
    projectPath,
    buildTarget,
    buildName,
    buildsPath,
    buildMethod,
  ]);
}

action().catch(error => {
  core.setFailed(error.message);
});
