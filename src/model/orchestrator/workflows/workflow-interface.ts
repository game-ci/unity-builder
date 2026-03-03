import { OrchestratorStepParameters } from '../options/orchestrator-step-parameters';

export interface WorkflowInterface {
  run(
    // eslint-disable-next-line no-unused-vars
    orchestratorStepState: OrchestratorStepParameters,
  ): Promise<string>;
}
