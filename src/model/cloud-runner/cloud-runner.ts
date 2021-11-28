import AWSBuildPlatform from './aws/aws-build-platform';
import { BuildParameters } from '..';
import CloudRunnerNamespace from './services/cloud-runner-namespace';
import { CloudRunnerState } from './state/cloud-runner-state';
import Kubernetes from './k8s/kubernetes-build-platform';
import CloudRunnerLogger from './services/cloud-runner-logger';
import { CloudRunnerStepState } from './state/cloud-runner-step-state';
import { WorkflowCompositionRoot } from './workflows/workflow-composition-root';
import { CloudRunnerError } from './error/cloud-runner-error';

class CloudRunner {
  private static setup(buildParameters: BuildParameters) {
    CloudRunnerLogger.setup();
    CloudRunnerState.buildGuid = CloudRunnerNamespace.generateBuildName(
      CloudRunnerState.readRunNumber(),
      buildParameters.platform,
    );
    CloudRunnerState.buildParams = buildParameters;
    CloudRunnerState.setupBranchName();
    CloudRunnerState.setupFolderVariables();
    CloudRunnerState.setupDefaultSecrets();
    CloudRunner.setupBuildPlatform();
  }

  private static setupBuildPlatform() {
    switch (CloudRunnerState.buildParams.cloudRunnerCluster) {
      case 'aws':
        CloudRunnerLogger.log('Building with AWS');
        CloudRunnerState.CloudRunnerProviderPlatform = new AWSBuildPlatform(CloudRunnerState.buildParams);
        break;
      default:
      case 'k8s':
        CloudRunnerLogger.log('Building with Kubernetes');
        CloudRunnerState.CloudRunnerProviderPlatform = new Kubernetes(CloudRunnerState.buildParams);
        break;
    }
  }

  static async run(buildParameters: BuildParameters, baseImage) {
    CloudRunner.setup(buildParameters);
    try {
      await CloudRunnerState.CloudRunnerProviderPlatform.setupSharedBuildResources(
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
      await CloudRunnerState.CloudRunnerProviderPlatform.cleanupSharedBuildResources(
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
