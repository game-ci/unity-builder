import * as core from '@actions/core';
import { Action, BuildParameters, Cache, Docker, ImageTag, Output, CloudRunner, Input } from './model';
import { Command } from 'commander-ts';
import { RemoteClientCli } from './model/cloud-runner/remote-client';
async function runMain() {
  try {
    Action.checkCompatibility();
    Cache.verify();

    const { dockerfile, workspace, actionFolder } = Action;

    const buildParameters = await BuildParameters.create();
    const baseImage = new ImageTag(buildParameters);
    let builtImage;

    switch (buildParameters.cloudRunnerCluster) {
      case 'aws':
      case 'k8s':
        await CloudRunner.run(buildParameters, baseImage.toString());
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
    core.setFailed((error as Error).message);
  }
}
async function runCli() {
  options.versioning = 'None';
  Input.cliOptions = options;
  const buildParameter = await BuildParameters.create();
  const baseImage = new ImageTag(buildParameter);
  await CloudRunner.run(buildParameter, baseImage.toString());
}
Input.githubEnabled = false;
const program = new Command();
program.version('0.0.1');
const properties = Object.getOwnPropertyNames(Input);
core.info(`\r\n`);
core.info(`INPUT:`);
for (const element of properties) {
  program.option(`--${element} <${element}>`, 'default description');
  if (Input[element] !== undefined && Input[element] !== '') {
    core.info(`${element} ${Input[element]}`);
  }
}
core.info(`\r\n`);
program.option('-m, --mode <mode>', 'cli or default');
program.parse(process.argv);

const options = program.opts();

// eslint-disable-next-line no-console
console.log(`Entrypoint: ${options.mode}`);

switch (options.mode) {
  case 'cli':
    runCli();
    break;
  case 'remote-cli':
    RemoteClientCli.RunRemoteClient(options);
    break;
  default:
    Input.githubEnabled = true;
    runMain();
    break;
}
