import CloudRunnerEnvironmentVariable from '../services/cloud-runner-environment-variable';
import CloudRunnerLogger from '../services/cloud-runner-logger';
import CloudRunnerSecret from '../services/cloud-runner-secret';
import { CloudRunnerState } from '../state/cloud-runner-state';
import { CloudRunnerStepState } from '../state/cloud-runner-step-state';
import { WorkflowInterface } from './workflow-interface';

export class EphemeralGitHubRunnerWorkflow implements WorkflowInterface {
  async run(cloudRunnerStepState: CloudRunnerStepState) {
    try {
      await EphemeralGitHubRunnerWorkflow.runJobAsEphemeralGitHubRunner(
        cloudRunnerStepState.image,
        cloudRunnerStepState.environment,
        cloudRunnerStepState.secrets,
      );
    } catch (error) {
      throw error;
    }
  }

  private static async runJobAsEphemeralGitHubRunner(
    image: string,
    environmentVariables: CloudRunnerEnvironmentVariable[],
    secrets: CloudRunnerSecret[],
  ) {
    try {
      CloudRunnerLogger.log(`Cloud Runner is running in ephemeral GitHub runner mode`);
      const installAndStartRunner =
        ' cd .. & cd .. && ls && mkdir actions-runner && cd actions-runner && curl -O -L https://github.com/actions/runner/releases/download/v2.283.1/actions-runner-linux-x64-2.283.1.tar.gz && tar xzf ./actions-runner-linux-x64-2.283.1.tar.gz';
      await CloudRunnerState.CloudRunnerProviderPlatform.runTask(
        CloudRunnerState.buildGuid,
        image,
        [installAndStartRunner],
        `/runner`,
        `/runner`,
        environmentVariables,
        secrets,
      );
    } catch (error) {
      throw error;
    }
  }
}
