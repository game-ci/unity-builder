import path from 'path';
import { Input } from '../..';
import { CloudRunnerBuildCommandProcessor } from '../services/cloud-runner-build-command-process';
import CloudRunnerEnvironmentVariable from '../services/cloud-runner-environment-variable';
import CloudRunnerLogger from '../services/cloud-runner-logger';
import CloudRunnerSecret from '../services/cloud-runner-secret';
import { CloudRunnerState } from '../state/cloud-runner-state';
import { CloudRunnerStepState } from '../state/cloud-runner-step-state';
import { StepInterface } from './step-interface';

export class SetupStep implements StepInterface {
  async run(cloudRunnerStepState: CloudRunnerStepState) {
    try {
      return await SetupStep.downloadRepository(
        cloudRunnerStepState.image,
        cloudRunnerStepState.environment,
        cloudRunnerStepState.secrets,
      );
    } catch (error) {
      throw error;
    }
  }

  private static async downloadRepository(
    image: string,
    environmentVariables: CloudRunnerEnvironmentVariable[],
    secrets: CloudRunnerSecret[],
  ) {
    try {
      CloudRunnerLogger.log(` `);
      CloudRunnerLogger.logLine('Starting step 1/2 (setup game files from repository)');
      const hooks = CloudRunnerBuildCommandProcessor.getHooks().filter((x) => x.step.includes(`setup`));
      return await CloudRunnerState.CloudRunnerProviderPlatform.runTask(
        CloudRunnerState.buildParams.buildGuid,
        image,
        `
        ${hooks.filter((x) => x.hook.includes(`before`)).map((x) => x.commands) || ' '}
        apk update -q
        apk add unzip zip git-lfs jq tree nodejs -q
        ${Input.cloudRunnerTests ? '' : '#'} apk add tree -q
        export GIT_DISCOVERY_ACROSS_FILESYSTEM=1
        mkdir -p ${CloudRunnerState.builderPathFull.replace(/\\/g, `/`)}
        git clone -q -b ${CloudRunnerState.branchName} ${
          CloudRunnerState.unityBuilderRepoUrl
        } "${CloudRunnerState.builderPathFull.replace(/\\/g, `/`)}"
        ${Input.cloudRunnerTests ? '' : '#'} tree ${CloudRunnerState.builderPathFull.replace(/\\/g, `/`)}
        chmod +x ${path.join(CloudRunnerState.builderPathFull, 'dist', `index.js`).replace(/\\/g, `/`)}
        node ${path.join(CloudRunnerState.builderPathFull, 'dist', `index.js`).replace(/\\/g, `/`)} -m remote-cli
        ${hooks.filter((x) => x.hook.includes(`after`)).map((x) => x.commands) || ' '}
        `,
        `/${CloudRunnerState.buildVolumeFolder}`,
        `/${CloudRunnerState.buildVolumeFolder}/`,
        environmentVariables,
        secrets,
      );
    } catch (error) {
      CloudRunnerLogger.logLine(`Failed download repository step 1/2`);
      throw error;
    }
  }
}
