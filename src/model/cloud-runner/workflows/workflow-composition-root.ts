import { CloudRunnerStepState } from '../cloud-runner-step-state';
import { CustomWorkflow } from './custom-workflow';
import { WorkflowInterface } from './workflow-interface';
import { BuildAutomationWorkflow } from './build-automation-workflow';
import CloudRunner from '../cloud-runner';

export class WorkflowCompositionRoot implements WorkflowInterface {
  async run(cloudRunnerStepState: CloudRunnerStepState) {
    try {
      if (CloudRunner.buildParameters.customJob !== '') {
        return await CustomWorkflow.runCustomJobFromString(
          CloudRunner.buildParameters.customJob,
          cloudRunnerStepState.environment,
          cloudRunnerStepState.secrets,
        );
      }

      return await new BuildAutomationWorkflow().run(
        new CloudRunnerStepState(
          cloudRunnerStepState.image.toString(),
          cloudRunnerStepState.environment,
          cloudRunnerStepState.secrets,
        ),
      );
    } catch (error) {
      throw error;
    }
  }
}
