import { OrchestratorStepParameters } from '../options/orchestrator-step-parameters';
import { CustomWorkflow } from './custom-workflow';
import { WorkflowInterface } from './workflow-interface';
import { BuildAutomationWorkflow } from './build-automation-workflow';
import Orchestrator from '../orchestrator';
import OrchestratorOptions from '../options/orchestrator-options';
import { AsyncWorkflow } from './async-workflow';

export class WorkflowCompositionRoot implements WorkflowInterface {
  async run(orchestratorStepState: OrchestratorStepParameters) {
    try {
      if (
        OrchestratorOptions.asyncOrchestrator &&
        !Orchestrator.isOrchestratorAsyncEnvironment &&
        !Orchestrator.isOrchestratorEnvironment
      ) {
        return await AsyncWorkflow.runAsyncWorkflow(orchestratorStepState.environment, orchestratorStepState.secrets);
      }

      if (Orchestrator.buildParameters.customJob !== '') {
        return await CustomWorkflow.runContainerJobFromString(
          Orchestrator.buildParameters.customJob,
          orchestratorStepState.environment,
          orchestratorStepState.secrets,
        );
      }

      return await new BuildAutomationWorkflow().run(
        new OrchestratorStepParameters(
          orchestratorStepState.image.toString(),
          orchestratorStepState.environment,
          orchestratorStepState.secrets,
        ),
      );
    } catch (error) {
      throw error;
    }
  }
}
