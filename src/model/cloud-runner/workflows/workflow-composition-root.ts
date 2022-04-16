import { CloudRunnerStepState } from '../cloud-runner-step-state';
import { CustomWorkflow } from './custom-workflow';
import { WorkflowInterface } from './workflow-interface';
import { BuildAutomationWorkflow } from './build-automation-workflow';
import CloudRunner from '../cloud-runner';

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
