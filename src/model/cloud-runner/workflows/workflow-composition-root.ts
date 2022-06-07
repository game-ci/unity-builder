import { CloudRunnerStepState } from '../cloud-runner-step-state.ts';
import { CustomWorkflow } from './custom-workflow.ts';
import { WorkflowInterface } from './workflow-interface.ts';
import { BuildAutomationWorkflow } from './build-automation-workflow.ts';
import CloudRunner from '../cloud-runner.ts';

export class WorkflowCompositionRoot implements WorkflowInterface {
  async run(cloudRunnerStepState: CloudRunnerStepState) {
    try {
      return await WorkflowCompositionRoot.runJob(cloudRunnerStepState.image.toString());
    } catch (error) {
      throw error;
    }
  }

  private static async runJob(baseImage: any) {
    try {
      if (CloudRunner.buildParameters.customJob !== '') {
        return await CustomWorkflow.runCustomJob(CloudRunner.buildParameters.customJob);
      }

      return await new BuildAutomationWorkflow().run(
        new CloudRunnerStepState(baseImage, CloudRunner.cloudRunnerEnvironmentVariables, CloudRunner.defaultSecrets),
      );
    } catch (error) {
      throw error;
    }
  }
}
