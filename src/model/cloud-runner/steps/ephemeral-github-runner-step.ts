import CloudRunnerEnvironmentVariable from '../services/cloud-runner-environment-variable';
import CloudRunnerLogger from '../services/cloud-runner-logger';
import CloudRunnerSecret from '../services/cloud-runner-secret';
import { CloudRunnerState } from '../state/cloud-runner-state';
import { CloudRunnerStepState } from '../state/cloud-runner-step-state';
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
      'ls && mkdir actions-runner && cd actions-runner && curl -O -L https://github.com/actions/runner/releases/download/v2.283.1/actions-runner-linux-x64-2.283.1.tar.gz && tar xzf ./actions-runner-linux-x64-2.283.1.tar.gz';
    await CloudRunnerState.CloudRunnerProviderPlatform.runBuildTask(
      CloudRunnerState.buildGuid,
      image,
      [installAndStartRunner],
      `/runner`,
      `/runner`,
      environmentVariables,
      secrets,
    );
  }
}
