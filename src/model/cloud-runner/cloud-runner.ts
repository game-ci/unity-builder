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
import LocalDockerCloudRunner from './providers/docker';
import GitHub from '../github';
import SharedWorkspaceLocking from './services/shared-workspace-locking';

class CloudRunner {
  public static Provider: ProviderInterface;
  public static buildParameters: BuildParameters;
  private static defaultSecrets: CloudRunnerSecret[];
  private static cloudRunnerEnvironmentVariables: CloudRunnerEnvironmentVariable[];
  static lockedWorkspace: string | undefined;
  public static readonly retainedWorkspacePrefix: string = `retained-workspace`;
  public static get isCloudRunnerEnvironment() {
    return process.env[`GITHUB_ACTIONS`] !== `true`;
  }
  public static get isCloudRunnerAsyncEnvironment() {
    return process.env[`GAMECI_ASYNC_WORKFLOW`] === `true`;
  }
  public static async setup(buildParameters: BuildParameters) {
    CloudRunnerLogger.setup();
    CloudRunnerLogger.log(`Setting up cloud runner`);
    CloudRunner.buildParameters = buildParameters;
    if (CloudRunner.buildParameters.githubCheckId === ``) {
      CloudRunner.buildParameters.githubCheckId = await GitHub.createGitHubCheck(CloudRunner.buildParameters.buildGuid);
    }
    CloudRunner.setupSelectedBuildPlatform();
    CloudRunner.defaultSecrets = TaskParameterSerializer.readDefaultSecrets();
    CloudRunner.cloudRunnerEnvironmentVariables =
      TaskParameterSerializer.createCloudRunnerEnvironmentVariables(buildParameters);
    if (GitHub.githubInputEnabled) {
      const buildParameterPropertyNames = Object.getOwnPropertyNames(buildParameters);
      for (const element of CloudRunner.cloudRunnerEnvironmentVariables) {
        // CloudRunnerLogger.log(`Cloud Runner output ${Input.ToEnvVarFormat(element.name)} = ${element.value}`);
        core.setOutput(Input.ToEnvVarFormat(element.name), element.value);
      }
      for (const element of buildParameterPropertyNames) {
        // CloudRunnerLogger.log(`Cloud Runner output ${Input.ToEnvVarFormat(element)} = ${buildParameters[element]}`);
        core.setOutput(Input.ToEnvVarFormat(element), buildParameters[element]);
      }
      core.setOutput(
        Input.ToEnvVarFormat(`buildArtifact`),
        `build-${CloudRunner.buildParameters.buildGuid}.tar${
          CloudRunner.buildParameters.useLz4Compression ? '.lz4' : ''
        }`,
      );
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
      case 'local-system':
        CloudRunner.Provider = new LocalCloudRunner();
        break;
    }
  }

  static async run(buildParameters: BuildParameters, baseImage: string) {
    await CloudRunner.setup(buildParameters);
    try {
      if (buildParameters.retainWorkspace) {
        CloudRunner.lockedWorkspace = `${CloudRunner.retainedWorkspacePrefix}-${CloudRunner.buildParameters.buildGuid}`;

        const result = await SharedWorkspaceLocking.GetOrCreateLockedWorkspace(
          CloudRunner.lockedWorkspace,
          CloudRunner.buildParameters.buildGuid,
          CloudRunner.buildParameters,
        );

        if (result) {
          CloudRunnerLogger.logLine(`Using retained workspace ${CloudRunner.lockedWorkspace}`);
          CloudRunner.cloudRunnerEnvironmentVariables = [
            ...CloudRunner.cloudRunnerEnvironmentVariables,
            { name: `LOCKED_WORKSPACE`, value: CloudRunner.lockedWorkspace },
          ];
        } else {
          CloudRunnerLogger.log(`Max retained workspaces reached ${buildParameters.maxRetainedWorkspaces}`);
          buildParameters.retainWorkspace = false;
          CloudRunner.lockedWorkspace = undefined;
        }
      }
      if (!CloudRunner.buildParameters.isCliMode) core.startGroup('Setup shared cloud runner resources');
      await CloudRunner.Provider.setupWorkflow(
        CloudRunner.buildParameters.buildGuid,
        CloudRunner.buildParameters,
        CloudRunner.buildParameters.branch,
        CloudRunner.defaultSecrets,
      );
      if (!CloudRunner.buildParameters.isCliMode) core.endGroup();
      const content = { ...CloudRunner.buildParameters };
      content.gitPrivateToken = ``;
      content.unitySerial = ``;
      const jsonContent = JSON.stringify(content, undefined, 4);
      await GitHub.updateGitHubCheck(jsonContent, CloudRunner.buildParameters.buildGuid);
      const output = await new WorkflowCompositionRoot().run(
        new CloudRunnerStepState(baseImage, CloudRunner.cloudRunnerEnvironmentVariables, CloudRunner.defaultSecrets),
      );
      if (!CloudRunner.buildParameters.isCliMode) core.startGroup('Cleanup shared cloud runner resources');
      await CloudRunner.Provider.cleanupWorkflow(
        CloudRunner.buildParameters.buildGuid,
        CloudRunner.buildParameters,
        CloudRunner.buildParameters.branch,
        CloudRunner.defaultSecrets,
      );
      CloudRunnerLogger.log(`Cleanup complete`);
      if (!CloudRunner.buildParameters.isCliMode) core.endGroup();
      await GitHub.updateGitHubCheck(CloudRunner.buildParameters.buildGuid, `success`, `success`, `completed`);

      if (CloudRunner.buildParameters.retainWorkspace) {
        await SharedWorkspaceLocking.ReleaseWorkspace(
          CloudRunner.lockedWorkspace || ``,
          CloudRunner.buildParameters.buildGuid,
          CloudRunner.buildParameters,
        );
        CloudRunner.lockedWorkspace = undefined;
      }

      if (buildParameters.constantGarbageCollection) {
        CloudRunner.Provider.garbageCollect(``, true, buildParameters.garbageCollectionMaxAge, true, true);
      }

      return output;
    } catch (error) {
      await GitHub.updateGitHubCheck(CloudRunner.buildParameters.buildGuid, error, `failure`, `completed`);
      if (!CloudRunner.buildParameters.isCliMode) core.endGroup();
      await CloudRunnerError.handleException(error, CloudRunner.buildParameters, CloudRunner.defaultSecrets);
      throw error;
    }
  }
}
export default CloudRunner;
