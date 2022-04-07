import AWSBuildPlatform from './cloud-runner-providers/aws';
import { BuildParameters, Input } from '..';
import Kubernetes from './cloud-runner-providers/k8s';
import CloudRunnerLogger from './services/cloud-runner-logger';
import { CloudRunnerStepState } from './cloud-runner-step-state';
import { WorkflowCompositionRoot } from './workflows/workflow-composition-root';
import { CloudRunnerError } from './error/cloud-runner-error';
import { TaskParameterSerializer } from './services/task-parameter-serializer';
import * as core from '@actions/core';
import CloudRunnerSecret from './services/cloud-runner-secret';
import { CloudRunnerProviderInterface } from './cloud-runner-providers/cloud-runner-provider-interface';
import CloudRunnerEnvironmentVariable from './services/cloud-runner-environment-variable';
import TestCloudRunner from './cloud-runner-providers/test';
import LocalCloudRunner from './cloud-runner-providers/local';
import LocalDockerCloudRunner from './cloud-runner-providers/local-docker';

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
      const buildParameterPropertyNames = Object.getOwnPropertyNames(buildParameters);
      for (const element of CloudRunner.cloudRunnerEnvironmentVariables) {
        core.setOutput(Input.ToEnvVarFormat(element.name), element.value);
      }
      for (const element of buildParameterPropertyNames) {
        core.setOutput(Input.ToEnvVarFormat(element), buildParameters[element]);
      }
    }
  }

  private static setupBuildPlatform() {
    CloudRunnerLogger.log(`Cloud Runner platform selected ${CloudRunner.buildParameters.cloudRunnerCluster}`);
    switch (CloudRunner.buildParameters.cloudRunnerCluster) {
      case 'k8s':
        CloudRunner.CloudRunnerProviderPlatform = new Kubernetes(CloudRunner.buildParameters);
        break;
      case 'aws':
        CloudRunner.CloudRunnerProviderPlatform = new AWSBuildPlatform(CloudRunner.buildParameters);
        break;
      case 'test':
        CloudRunner.CloudRunnerProviderPlatform = new TestCloudRunner();
        break;
      case 'local-system':
        CloudRunner.CloudRunnerProviderPlatform = new LocalCloudRunner();
        break;
      case 'local-docker':
        CloudRunner.CloudRunnerProviderPlatform = new LocalDockerCloudRunner();
        break;
    }
  }

  static async run(buildParameters: BuildParameters, baseImage: string) {
    CloudRunner.setup(buildParameters);
    try {
      if (!CloudRunner.buildParameters.cliMode) core.startGroup('Setup shared cloud runner resources');
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
      if (!CloudRunner.buildParameters.cliMode) core.startGroup('Cleanup shared cloud runner resources');
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
