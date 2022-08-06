import { CloudRunnerStepState } from '../cloud-runner-step-state.ts';

export interface WorkflowInterface {
  run(cloudRunnerStepState: CloudRunnerStepState);
}
