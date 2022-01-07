import { CloudRunnerState } from '../state/cloud-runner-state';
import { CloudRunnerStepState } from '../state/cloud-runner-step-state';
import { CustomWorkflow } from './custom-workflow';
import { WorkflowInterface } from './workflow-interface';
import { BuildAutomationWorkflow } from './build-automation-workflow';
import { TaskParameterSerializer } from '../services/task-parameter-serializer';
import { SetupStep } from '../steps/setup-step';

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
      if (CloudRunnerState.buildParams.customJob === `setup`) {
        return await new SetupStep().run(
          new CloudRunnerStepState(
            baseImage,
            TaskParameterSerializer.readBuildEnvironmentVariables(),
            CloudRunnerState.defaultSecrets,
          ),
        );
      } else if (CloudRunnerState.buildParams.customJob !== '') {
        return await CustomWorkflow.runCustomJob(CloudRunnerState.buildParams.customJob);
      }
      return await new BuildAutomationWorkflow().run(
        new CloudRunnerStepState(
          baseImage,
          TaskParameterSerializer.readBuildEnvironmentVariables(),
          CloudRunnerState.defaultSecrets,
        ),
      );
    } catch (error) {
      throw error;
    }
  }
}
