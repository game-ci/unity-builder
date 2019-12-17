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
  const buildTarget = core.getInput('buildTarget', { default: 'WebGL' });
  const buildName = core.getInput('buildName', { default: 'TestBuild' });
  const buildsPath = core.getInput('buildsPath', { default: 'build' });
  const buildMethod = core.getInput('buildMethod', { default: '' });

  // Run appropriate docker image with given args
  const bootstrapper = path.join(__dirname, 'run-unity-builder.sh');
  await exec(`ls ${bootstrapper}`);
  await exec(`chmod +x ${bootstrapper}`);
  await exec(bootstrapper, [projectPath, buildTarget, buildName, buildsPath, buildMethod]);
}

action().catch(error => {
  core.setFailed(error.message);
});
