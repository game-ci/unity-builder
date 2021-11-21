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
      CloudRunnerLogger.log('Starting step 1/4 clone and restore cache');
      await CloudRunnerState.CloudRunnerProviderPlatform.runBuildTask(
        CloudRunnerState.buildGuid,
        image,
        [
          ` printenv
          apk update -q
          apk add unzip zip git-lfs jq tree -q
          mkdir -p ${CloudRunnerState.buildPathFull}
          mkdir -p ${CloudRunnerState.builderPathFull}
          mkdir -p ${CloudRunnerState.repoPathFull}
          ${CloudRunnerState.getCloneBuilder()}
          echo ' '
          echo 'Initializing source repository for cloning with caching of LFS files'
          ${CloudRunnerState.getCloneNoLFSCommand()}
          echo 'Source repository initialized'
          echo ' '
          echo 'Starting checks of cache for the Unity project Library and git LFS files'
          ${CloudRunnerState.getHandleCachingCommand()}
      `,
        ],
        `/${CloudRunnerState.buildVolumeFolder}`,
        `/${CloudRunnerState.buildVolumeFolder}/`,
        environmentVariables,
        secrets,
      );
    } catch (error) {
      throw error;
    }
  }
}
