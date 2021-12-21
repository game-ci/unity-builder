import CloudRunnerEnvironmentVariable from '../services/cloud-runner-environment-variable';
import CloudRunnerLogger from '../services/cloud-runner-logger';
import CloudRunnerSecret from '../services/cloud-runner-secret';
import { CloudRunnerState } from '../state/cloud-runner-state';
import { CloudRunnerStepState } from '../state/cloud-runner-step-state';
import { StepInterface } from './step-interface';

export class DownloadRepositoryStep implements StepInterface {
  async run(cloudRunnerStepState: CloudRunnerStepState) {
    try {
      await DownloadRepositoryStep.downloadRepositoryStep(
        cloudRunnerStepState.image,
        cloudRunnerStepState.environment,
        cloudRunnerStepState.secrets,
      );
    } catch (error) {
      throw error;
    }
  }

  private static async downloadRepositoryStep(
    image: string,
    environmentVariables: CloudRunnerEnvironmentVariable[],
    secrets: CloudRunnerSecret[],
  ) {
    try {
      CloudRunnerLogger.logLine('Starting step 1/4 clone and restore cache');
      await CloudRunnerState.CloudRunnerProviderPlatform.runBuildTask(
        CloudRunnerState.buildGuid,
        image,
        [
          `
          apk update -q
          apk add unzip zip git-lfs jq tree nodejs -q
          export GIT_DISCOVERY_ACROSS_FILESYSTEM=1
          mkdir -p ${CloudRunnerState.builderPathFull}
          echo "${CloudRunnerState.cloneBuilderCommand}"
          ${CloudRunnerState.cloneBuilderCommand}
          chmod +x ${CloudRunnerState.builderPathFull}/dist/index.js
          node ${CloudRunnerState.builderPathFull}/dist/index.js -m remote-cli
      `,
        ],
        `/${CloudRunnerState.buildVolumeFolder}`,
        `/${CloudRunnerState.buildVolumeFolder}/`,
        environmentVariables,
        secrets,
      );
    } catch (error) {
      CloudRunnerLogger.logLine(`ENV VARS ${JSON.stringify(environmentVariables)} SECRETS ${JSON.stringify(secrets)}`);
      throw error;
    }
  }
}
