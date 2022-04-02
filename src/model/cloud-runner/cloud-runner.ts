import AWSBuildPlatform from './aws';
import { BuildParameters } from '..';
import { CloudRunnerState } from './state/cloud-runner-state';
import Kubernetes from './k8s';
import CloudRunnerLogger from './services/cloud-runner-logger';
import { CloudRunnerStepState } from './state/cloud-runner-step-state';
import { WorkflowCompositionRoot } from './workflows/workflow-composition-root';
import { CloudRunnerError } from './error/cloud-runner-error';
import { TaskParameterSerializer } from './services/task-parameter-serializer';
import * as core from '@actions/core';

class CloudRunner {
  private static setup(buildParameters: BuildParameters) {
    CloudRunnerLogger.setup();
    CloudRunnerState.setup(buildParameters);
    CloudRunner.setupBuildPlatform();
    const parameters = TaskParameterSerializer.readBuildEnvironmentVariables();
    if (!buildParameters.cliMode) {
      for (const element of parameters) {
        core.setOutput(element.name, element.value);
      }
    }
  }

  private static setupBuildPlatform() {
    switch (CloudRunnerState.buildParams.cloudRunnerCluster) {
      case 'k8s':
        CloudRunnerLogger.log('Cloud Runner platform selected Kubernetes');
        CloudRunnerState.CloudRunnerProviderPlatform = new Kubernetes(CloudRunnerState.buildParams);
        break;
      default:
      case 'aws':
        CloudRunnerLogger.log('Cloud Runner platform selected AWS');
        CloudRunnerState.CloudRunnerProviderPlatform = new AWSBuildPlatform(CloudRunnerState.buildParams);
        break;
    }
  }

  static async run(buildParameters: BuildParameters, baseImage: string) {
    CloudRunner.setup(buildParameters);
    try {
      if (!CloudRunnerState.buildParams.cliMode) core.startGroup('Setup remote runner');
      await CloudRunnerState.CloudRunnerProviderPlatform.setupSharedResources(
        CloudRunnerState.buildParams.buildGuid,
        CloudRunnerState.buildParams,
        CloudRunnerState.branchName,
        CloudRunnerState.defaultSecrets,
      );
      if (!CloudRunnerState.buildParams.cliMode) core.endGroup();
      const output = await new WorkflowCompositionRoot().run(
        new CloudRunnerStepState(
          baseImage,
          TaskParameterSerializer.readBuildEnvironmentVariables(),
          CloudRunnerState.defaultSecrets,
        ),
      );
      if (!CloudRunnerState.buildParams.cliMode) core.startGroup('Cleanup');
      await CloudRunnerState.CloudRunnerProviderPlatform.cleanupSharedResources(
        CloudRunnerState.buildParams.buildGuid,
        CloudRunnerState.buildParams,
        CloudRunnerState.branchName,
        CloudRunnerState.defaultSecrets,
      );
      CloudRunnerLogger.log(`Cleanup complete`);
      if (!CloudRunnerState.buildParams.cliMode) core.endGroup();
      return output;
    } catch (error) {
      if (!CloudRunnerState.buildParams.cliMode) core.endGroup();
      await CloudRunnerError.handleException(error);
      throw error;
    }
  }
}
export default CloudRunner;
