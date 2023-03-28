import { CloudRunnerStepParameters } from '../options/cloud-runner-step-parameters';

export interface WorkflowInterface {
  run(
    // eslint-disable-next-line no-unused-vars
    cloudRunnerStepState: CloudRunnerStepParameters,
  ): Promise<string>;
}
