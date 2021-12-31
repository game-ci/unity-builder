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
      CloudRunnerLogger.log(
        `git clone -b ${CloudRunnerState.branchName} ${
          CloudRunnerState.unityBuilderRepoUrl
        } ${CloudRunnerState.builderPathFull.replace(/\\/g, `/`)}`,
      );

      return await CloudRunnerState.CloudRunnerProviderPlatform.runTask(
        CloudRunnerState.buildParams.buildGuid,
        image,
        `
        apk update -q
        apk add unzip zip git-lfs jq tree nodejs -q
        export GIT_DISCOVERY_ACROSS_FILESYSTEM=1
        mkdir -p ${CloudRunnerState.builderPathFull}
        git clone -b ${CloudRunnerState.branchName} ${
          CloudRunnerState.unityBuilderRepoUrl
        } ${CloudRunnerState.builderPathFull.replace(`/`, `\\`)}
        chmod +x ${CloudRunnerState.builderPathFull.replace(`/`, `\\`)}/dist/index.js
        node ${CloudRunnerState.builderPathFull.replace(`/`, `\\`)}/dist/index.js -m remote-cli
        `,
        `/${CloudRunnerState.buildVolumeFolder.replace(`/`, `\\`)}`,
        `/${CloudRunnerState.buildVolumeFolder.replace(`/`, `\\`)}/`,
        environmentVariables,
        secrets,
      );
    } catch (error) {
      CloudRunnerLogger.logLine(`Failed download repository step 1/2`);
      throw error;
    }
  }
}
