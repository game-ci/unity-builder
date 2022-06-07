import AwsBuildPlatform from './providers/aws/index.ts';
import { BuildParameters, Input } from '../index.ts';
import Kubernetes from './providers/k8s/index.ts';
import CloudRunnerLogger from './services/cloud-runner-logger.ts';
import { CloudRunnerStepState } from './cloud-runner-step-state.ts';
import { WorkflowCompositionRoot } from './workflows/workflow-composition-root.ts';
import { CloudRunnerError } from './error/cloud-runner-error.ts';
import { TaskParameterSerializer } from './services/task-parameter-serializer.ts';
import * as core from '../../../node_modules/@actions/core';
import CloudRunnerSecret from './services/cloud-runner-secret.ts';
import { ProviderInterface } from './providers/provider-interface.ts';
import CloudRunnerEnvironmentVariable from './services/cloud-runner-environment-variable.ts';
import TestCloudRunner from './providers/test/index.ts';
import LocalCloudRunner from './providers/local/index.ts';
import LocalDockerCloudRunner from './providers/local-docker/index.ts';

class CloudRunner {
  public static Provider: ProviderInterface;
  static buildParameters: BuildParameters;
  public static defaultSecrets: CloudRunnerSecret[];
  public static cloudRunnerEnvironmentVariables: CloudRunnerEnvironmentVariable[];
  private static setup(buildParameters: BuildParameters) {
    CloudRunnerLogger.setup();
    CloudRunner.buildParameters = buildParameters;
    CloudRunner.setupBuildPlatform();
    CloudRunner.defaultSecrets = TaskParameterSerializer.readDefaultSecrets();
    CloudRunner.cloudRunnerEnvironmentVariables = TaskParameterSerializer.readBuildEnvironmentVariables();
    if (!buildParameters.isCliMode) {
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
        CloudRunner.Provider = new Kubernetes(CloudRunner.buildParameters);
        break;
      case 'aws':
        CloudRunner.Provider = new AwsBuildPlatform(CloudRunner.buildParameters);
        break;
      case 'test':
        CloudRunner.Provider = new TestCloudRunner();
        break;
      case 'local-system':
        CloudRunner.Provider = new LocalCloudRunner();
        break;
      case 'local-docker':
        CloudRunner.Provider = new LocalDockerCloudRunner();
        break;
    }
  }

  static async run(buildParameters: BuildParameters, baseImage: string) {
    CloudRunner.setup(buildParameters);
    try {
      if (!CloudRunner.buildParameters.isCliMode) core.startGroup('Setup shared cloud runner resources');
      await CloudRunner.Provider.setup(
        CloudRunner.buildParameters.buildGuid,
        CloudRunner.buildParameters,
        CloudRunner.buildParameters.branch,
        CloudRunner.defaultSecrets,
      );
      if (!CloudRunner.buildParameters.isCliMode) core.endGroup();
      const output = await new WorkflowCompositionRoot().run(
        new CloudRunnerStepState(baseImage, CloudRunner.cloudRunnerEnvironmentVariables, CloudRunner.defaultSecrets),
      );
      if (!CloudRunner.buildParameters.isCliMode) core.startGroup('Cleanup shared cloud runner resources');
      await CloudRunner.Provider.cleanup(
        CloudRunner.buildParameters.buildGuid,
        CloudRunner.buildParameters,
        CloudRunner.buildParameters.branch,
        CloudRunner.defaultSecrets,
      );
      CloudRunnerLogger.log(`Cleanup complete`);
      if (!CloudRunner.buildParameters.isCliMode) core.endGroup();

      return output;
    } catch (error) {
      if (!CloudRunner.buildParameters.isCliMode) core.endGroup();
      await CloudRunnerError.handleException(error);
      throw error;
    }
  }
}
export default CloudRunner;
