import AWSBuildPlatform from './aws';
import { BuildParameters } from '..';
import { CloudRunnerState } from './state/cloud-runner-state';
import Kubernetes from './k8s';
import CloudRunnerLogger from './services/cloud-runner-logger';
import { CloudRunnerStepState } from './state/cloud-runner-step-state';
import { WorkflowCompositionRoot } from './workflows/workflow-composition-root';
import { CloudRunnerError } from './error/cloud-runner-error';

class CloudRunner {
  private static setup(buildParameters: BuildParameters) {
    CloudRunnerLogger.setup();
    CloudRunnerState.setup(buildParameters);
    CloudRunner.setupBuildPlatform();
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
      await CloudRunnerState.CloudRunnerProviderPlatform.setupSharedResources(
        CloudRunnerState.buildGuid,
        CloudRunnerState.buildParams,
        CloudRunnerState.branchName,
        CloudRunnerState.defaultSecrets,
      );
      await new WorkflowCompositionRoot().run(
        new CloudRunnerStepState(
          baseImage,
          CloudRunnerState.readBuildEnvironmentVariables(),
          CloudRunnerState.defaultSecrets,
        ),
      );
      await CloudRunnerState.CloudRunnerProviderPlatform.cleanupSharedResources(
        CloudRunnerState.buildGuid,
        CloudRunnerState.buildParams,
        CloudRunnerState.branchName,
        CloudRunnerState.defaultSecrets,
      );
    } catch (error) {
      await CloudRunnerError.handleException(error);
      throw error;
    }
  }
}
export default CloudRunner;
