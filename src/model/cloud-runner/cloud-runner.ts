import AWSBuildPlatform from './aws';
import { BuildParameters } from '..';
import Kubernetes from './k8s';
import CloudRunnerLogger from './services/cloud-runner-logger';
import { CloudRunnerStepState } from './cloud-runner-step-state';
import { WorkflowCompositionRoot } from './workflows/workflow-composition-root';
import { CloudRunnerError } from './error/cloud-runner-error';
import { TaskParameterSerializer } from './services/task-parameter-serializer';
import * as core from '@actions/core';
import CloudRunnerSecret from './services/cloud-runner-secret';
import { CloudRunnerProviderInterface } from './services/cloud-runner-provider-interface';
import CloudRunnerEnvironmentVariable from './services/cloud-runner-environment-variable';

class CloudRunner {
  public static CloudRunnerProviderPlatform: CloudRunnerProviderInterface;
  static buildParameters: BuildParameters;
  public static defaultSecrets: CloudRunnerSecret[];
  public static cloudRunnerEnvironmentVariables: CloudRunnerEnvironmentVariable[];
  private static setup(buildParameters: BuildParameters) {
    CloudRunnerLogger.setup();
    CloudRunner.buildParameters = buildParameters;
    CloudRunner.setupBuildPlatform();
    CloudRunner.defaultSecrets = TaskParameterSerializer.readDefaultSecrets();
    CloudRunner.cloudRunnerEnvironmentVariables = TaskParameterSerializer.readBuildEnvironmentVariables();
    if (!buildParameters.cliMode) {
      for (const element of CloudRunner.cloudRunnerEnvironmentVariables) {
        core.setOutput(element.name, element.value);
      }
    }
  }

  private static setupBuildPlatform() {
    switch (CloudRunner.buildParameters.cloudRunnerCluster) {
      case 'k8s':
        CloudRunnerLogger.log('Cloud Runner platform selected Kubernetes');
        CloudRunner.CloudRunnerProviderPlatform = new Kubernetes(CloudRunner.buildParameters);
        break;
      default:
      case 'aws':
        CloudRunnerLogger.log('Cloud Runner platform selected AWS');
        CloudRunner.CloudRunnerProviderPlatform = new AWSBuildPlatform(CloudRunner.buildParameters);
        break;
    }
  }

  static async run(buildParameters: BuildParameters, baseImage: string) {
    CloudRunner.setup(buildParameters);
    try {
      if (!CloudRunner.buildParameters.cliMode) core.startGroup('Setup remote runner');
      await CloudRunner.CloudRunnerProviderPlatform.setupSharedResources(
        CloudRunner.buildParameters.buildGuid,
        CloudRunner.buildParameters,
        CloudRunner.buildParameters.branch,
        CloudRunner.defaultSecrets,
      );
      if (!CloudRunner.buildParameters.cliMode) core.endGroup();
      const output = await new WorkflowCompositionRoot().run(
        new CloudRunnerStepState(baseImage, CloudRunner.cloudRunnerEnvironmentVariables, CloudRunner.defaultSecrets),
      );
      if (!CloudRunner.buildParameters.cliMode) core.startGroup('Cleanup');
      await CloudRunner.CloudRunnerProviderPlatform.cleanupSharedResources(
        CloudRunner.buildParameters.buildGuid,
        CloudRunner.buildParameters,
        CloudRunner.buildParameters.branch,
        CloudRunner.defaultSecrets,
      );
      CloudRunnerLogger.log(`Cleanup complete`);
      if (!CloudRunner.buildParameters.cliMode) core.endGroup();
      return output;
    } catch (error) {
      if (!CloudRunner.buildParameters.cliMode) core.endGroup();
      await CloudRunnerError.handleException(error);
      throw error;
    }
  }
}
export default CloudRunner;
