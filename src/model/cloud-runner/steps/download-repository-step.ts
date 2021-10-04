import CloudRunnerEnvironmentVariable from '../services/cloud-runner-environment-variable';
import CloudRunnerLogger from '../services/cloud-runner-logger';
import CloudRunnerSecret from '../services/cloud-runner-secret';
import { CloudRunnerState } from '../state/cloud-runner-state';
import { CloudRunnerStepState } from '../state/cloud-runner-step-state';
import { StandardStepInterface } from './standard-step-interface';

export class DownloadRepositoryStep implements StandardStepInterface {
  async run(cloudRunnerStepState: CloudRunnerStepState) {
    await DownloadRepositoryStep.downloadRepositoryStep(
      cloudRunnerStepState.image,
      cloudRunnerStepState.environment,
      cloudRunnerStepState.secrets,
    );
  }

  private static async downloadRepositoryStep(
    image: string,
    environmentVariables: CloudRunnerEnvironmentVariable[],
    secrets: CloudRunnerSecret[],
  ) {
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
  }
}
