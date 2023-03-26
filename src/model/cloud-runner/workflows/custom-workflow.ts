import CloudRunnerLogger from '../services/core/cloud-runner-logger';
import CloudRunnerSecret from '../options/cloud-runner-secret';
import { CloudRunnerFolders } from '../options/cloud-runner-folders';
import CloudRunnerEnvironmentVariable from '../options/cloud-runner-environment-variable';
import { CloudRunnerContainerHook } from '../services/cloud-runner-hooks/cloud-runner-container-hook';
import { ContainerHook } from '../services/cloud-runner-hooks/container-hook';
import CloudRunner from '../cloud-runner';

export class CustomWorkflow {
  public static async runContainerJobFromString(
    buildSteps: string,
    environmentVariables: CloudRunnerEnvironmentVariable[],
    secrets: CloudRunnerSecret[],
  ): Promise<string> {
    return await CustomWorkflow.runContainerJob(
      CloudRunnerContainerHook.ParseContainerHooks(buildSteps),
      environmentVariables,
      secrets,
    );
  }

  public static async runContainerJob(
    steps: ContainerHook[],
    environmentVariables: CloudRunnerEnvironmentVariable[],
    secrets: CloudRunnerSecret[],
  ) {
    try {
      let output = '';

      // if (CloudRunner.buildParameters?.cloudRunnerDebug) {
      //   CloudRunnerLogger.log(`Custom Job Description \n${JSON.stringify(buildSteps, undefined, 4)}`);
      // }
      for (const step of steps) {
        CloudRunnerLogger.log(`Cloud Runner is running in custom job mode`);
        output += await CloudRunner.Provider.runTaskInWorkflow(
          CloudRunner.buildParameters.buildGuid,
          step.image,
          step.commands,
          `/${CloudRunnerFolders.buildVolumeFolder}`,
          `/${CloudRunnerFolders.projectPathAbsolute}/`,
          environmentVariables,
          [...secrets, ...step.secrets],
        );
      }

      return output;
    } catch (error) {
      throw error;
    }
  }
}
