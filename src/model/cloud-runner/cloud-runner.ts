import AwsBuildPlatform from './providers/aws';
import { BuildParameters, Input } from '..';
import Kubernetes from './providers/k8s';
import CloudRunnerLogger from './services/cloud-runner-logger';
import { CloudRunnerStepState } from './cloud-runner-step-state';
import { WorkflowCompositionRoot } from './workflows/workflow-composition-root';
import { CloudRunnerError } from './error/cloud-runner-error';
import { TaskParameterSerializer } from './services/task-parameter-serializer';
import * as core from '@actions/core';
import CloudRunnerSecret from './services/cloud-runner-secret';
import { ProviderInterface } from './providers/provider-interface';
import CloudRunnerEnvironmentVariable from './services/cloud-runner-environment-variable';
import TestCloudRunner from './providers/test';
import LocalCloudRunner from './providers/local';
import LocalDockerCloudRunner from './providers/local-docker';
import GitHub from '../github';
import CloudRunnerOptions from './cloud-runner-options';
import SharedWorkspaceLocking from './services/shared-workspace-locking';

class CloudRunner {
  public static Provider: ProviderInterface;
  public static buildParameters: BuildParameters;
  private static defaultSecrets: CloudRunnerSecret[];
  private static cloudRunnerEnvironmentVariables: CloudRunnerEnvironmentVariable[];
  static lockedWorkspace: string | undefined;
  public static setup(buildParameters: BuildParameters) {
    CloudRunnerLogger.setup();
    CloudRunnerLogger.log(`Setting up cloud runner`);
    CloudRunner.buildParameters = buildParameters;
    CloudRunner.setupSelectedBuildPlatform();
    CloudRunner.defaultSecrets = TaskParameterSerializer.readDefaultSecrets();
    CloudRunner.cloudRunnerEnvironmentVariables =
      TaskParameterSerializer.createCloudRunnerEnvironmentVariables(buildParameters);
    if (!buildParameters.isCliMode && GitHub.githubInputEnabled) {
      const buildParameterPropertyNames = Object.getOwnPropertyNames(buildParameters);
      for (const element of CloudRunner.cloudRunnerEnvironmentVariables) {
        core.setOutput(Input.ToEnvVarFormat(element.name), element.value);
      }
      for (const element of buildParameterPropertyNames) {
        core.setOutput(Input.ToEnvVarFormat(element), buildParameters[element]);
      }
    }
  }

  private static setupSelectedBuildPlatform() {
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
      case 'local-docker':
        CloudRunner.Provider = new LocalDockerCloudRunner();
        break;
      default:
        CloudRunner.Provider = new LocalCloudRunner();
        break;
    }
  }

  static async run(buildParameters: BuildParameters, baseImage: string) {
    CloudRunner.setup(buildParameters);
    try {
      if (buildParameters.retainWorkspace) {
        const workspace = `test-workspace-${CloudRunner.buildParameters.buildGuid}`;
        const result =
          (await SharedWorkspaceLocking.GetOrCreateLockedWorkspace(
            workspace,
            CloudRunner.buildParameters.buildGuid,
            CloudRunner.buildParameters,
          )) || CloudRunner.buildParameters.buildGuid;

        if (result) {
          CloudRunner.lockedWorkspace = workspace;

          CloudRunnerLogger.logLine(`Using workspace ${workspace}`);
          CloudRunner.cloudRunnerEnvironmentVariables = [
            ...CloudRunner.cloudRunnerEnvironmentVariables,
            { name: `LOCKED_WORKSPACE`, value: workspace },
          ];
        } else {
          buildParameters.retainWorkspace = false;
        }
      }
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

      if (CloudRunnerOptions.retainWorkspaces) {
        await SharedWorkspaceLocking.ReleaseWorkspace(
          `test-workspace-${CloudRunner.buildParameters.buildGuid}`,
          CloudRunner.buildParameters.buildGuid,
          CloudRunner.buildParameters,
        );
        CloudRunner.lockedWorkspace = undefined;
      }

      return output;
    } catch (error) {
      if (!CloudRunner.buildParameters.isCliMode) core.endGroup();
      await CloudRunnerError.handleException(error, CloudRunner.buildParameters, CloudRunner.defaultSecrets);
      throw error;
    }
  }
}
export default CloudRunner;
