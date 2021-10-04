import CloudRunnerEnvironmentVariable from '../cloud-runner-services/cloud-runner-environment-variable';
import CloudRunnerLogger from '../cloud-runner-services/cloud-runner-logger';
import CloudRunnerSecret from '../cloud-runner-services/cloud-runner-secret';
import { CloudRunnerState } from '../cloud-runner-state/cloud-runner-state';
import { CloudRunnerStepState } from '../cloud-runner-state/cloud-runner-step-state';
import { StandardStepInterface } from './standard-step-interface';

export class EphemeralGitHubRunnerStep implements StandardStepInterface {
  async run(cloudRunnerStepState: CloudRunnerStepState) {
    await EphemeralGitHubRunnerStep.runJobAsEphemeralGitHubRunner(
      cloudRunnerStepState.image,
      cloudRunnerStepState.environment,
      cloudRunnerStepState.secrets,
    );
  }

  private static async runJobAsEphemeralGitHubRunner(
    image: string,
    environmentVariables: CloudRunnerEnvironmentVariable[],
    secrets: CloudRunnerSecret[],
  ) {
    CloudRunnerLogger.log(`Cloud Runner is running in ephemeral GitHub runner mode`);
    const installAndStartRunner =
      'mkdir actions-runner && cd actions-runner && curl -O -L https://github.com/actions/runner/releases/download/v2.283.1/actions-runner-linux-x64-2.283.1.tar.gz && tar xzf ./actions-runner-linux-x64-2.283.1.tar.gz';
    await CloudRunnerState.CloudRunnerProviderPlatform.runBuildTask(
      CloudRunnerState.buildGuid,
      image,
      [installAndStartRunner],
      `/${CloudRunnerState.buildVolumeFolder}`,
      `/${CloudRunnerState.buildVolumeFolder}`,
      environmentVariables,
      secrets,
    );
  }
}
