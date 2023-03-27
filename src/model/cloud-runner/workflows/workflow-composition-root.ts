import { CloudRunnerStepParameters } from '../options/cloud-runner-step-parameters';
import { CustomWorkflow } from './custom-workflow';
import { WorkflowInterface } from './workflow-interface';
import { BuildAutomationWorkflow } from './build-automation-workflow';
import CloudRunner from '../cloud-runner';
import CloudRunnerOptions from '../options/cloud-runner-options';
import { AsyncWorkflow } from './async-workflow';

export class WorkflowCompositionRoot implements WorkflowInterface {
  async run(cloudRunnerStepState: CloudRunnerStepParameters) {
    try {
      if (
        CloudRunnerOptions.asyncCloudRunner &&
        !CloudRunner.isCloudRunnerAsyncEnvironment &&
        !CloudRunner.isCloudRunnerEnvironment
      ) {
        return await AsyncWorkflow.runAsyncWorkflow(cloudRunnerStepState.environment, cloudRunnerStepState.secrets);
      }

      if (CloudRunner.buildParameters.customJob !== '') {
        return await CustomWorkflow.runContainerJobFromString(
          CloudRunner.buildParameters.customJob,
          cloudRunnerStepState.environment,
          cloudRunnerStepState.secrets,
        );
      }

      return await new BuildAutomationWorkflow().run(
        new CloudRunnerStepParameters(
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
