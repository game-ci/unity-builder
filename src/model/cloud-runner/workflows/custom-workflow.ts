import CloudRunnerLogger from '../services/cloud-runner-logger';
import CloudRunnerSecret from '../services/cloud-runner-secret';
import { CloudRunnerFolders } from '../services/cloud-runner-folders';
import CloudRunnerEnvironmentVariable from '../services/cloud-runner-environment-variable';
import { CloudRunnerCustomSteps } from '../services/cloud-runner-custom-steps';
import { CustomStep } from '../services/custom-step';
import CloudRunner from '../cloud-runner';

export class CustomWorkflow {
  public static async runCustomJobFromString(
    buildSteps: string,
    environmentVariables: CloudRunnerEnvironmentVariable[],
    secrets: CloudRunnerSecret[],
  ): Promise<string> {
    return await CustomWorkflow.runCustomJob(
      CloudRunnerCustomSteps.ParseSteps(buildSteps),
      environmentVariables,
      secrets,
    );
  }

  public static async runCustomJob(
    buildSteps: CustomStep[],
    environmentVariables: CloudRunnerEnvironmentVariable[],
    secrets: CloudRunnerSecret[],
  ) {
    try {
      let output = '';

      // if (CloudRunner.buildParameters?.cloudRunnerDebug) {
      //   CloudRunnerLogger.log(`Custom Job Description \n${JSON.stringify(buildSteps, undefined, 4)}`);
      // }
      for (const step of buildSteps) {
        CloudRunnerLogger.log(
          `Cloud Runner is running in custom job mode Secrets Count:${JSON.stringify(
            [...secrets, ...step.secrets],
            undefined,
            4,
          )} Env Var Count:${JSON.stringify(environmentVariables, undefined, 4)}`,
        );
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
