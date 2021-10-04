import { CloudRunnerStepState } from '../cloud-runner-state/cloud-runner-step-state';

export interface StandardStepInterface {
  run(
    // eslint-disable-next-line no-unused-vars
    cloudRunnerStepState: CloudRunnerStepState,
  );
}
