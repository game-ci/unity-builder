import { CloudRunnerStepState } from '../cloud-runner-step-state';

export interface WorkflowInterface {
  run(
    // eslint-disable-next-line no-unused-vars
    cloudRunnerStepState: CloudRunnerStepState,
  ): Promise<string>;
}
