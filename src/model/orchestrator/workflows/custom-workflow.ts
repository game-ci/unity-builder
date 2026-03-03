import OrchestratorLogger from '../services/core/orchestrator-logger';
import OrchestratorSecret from '../options/orchestrator-secret';
import { OrchestratorFolders } from '../options/orchestrator-folders';
import OrchestratorEnvironmentVariable from '../options/orchestrator-environment-variable';
import { ContainerHookService } from '../services/hooks/container-hook-service';
import { ContainerHook } from '../services/hooks/container-hook';
import Orchestrator from '../orchestrator';

export class CustomWorkflow {
  public static async runContainerJobFromString(
    buildSteps: string,
    environmentVariables: OrchestratorEnvironmentVariable[],
    secrets: OrchestratorSecret[],
  ): Promise<string> {
    return await CustomWorkflow.runContainerJob(
      ContainerHookService.ParseContainerHooks(buildSteps),
      environmentVariables,
      secrets,
    );
  }

  public static async runContainerJob(
    steps: ContainerHook[],
    environmentVariables: OrchestratorEnvironmentVariable[],
    secrets: OrchestratorSecret[],
  ) {
    try {
      let output = '';

      // if (Orchestrator.buildParameters?.orchestratorDebug) {
      //   OrchestratorLogger.log(`Custom Job Description \n${JSON.stringify(buildSteps, undefined, 4)}`);
      // }
      for (const step of steps) {
        OrchestratorLogger.log(`Orchestrator is running in custom job mode`);
        try {
          const stepOutput = await Orchestrator.Provider.runTaskInWorkflow(
            Orchestrator.buildParameters.buildGuid,
            step.image,
            step.commands,
            `/${OrchestratorFolders.buildVolumeFolder}`,
            `/${OrchestratorFolders.projectPathAbsolute}/`,
            environmentVariables,
            [...secrets, ...step.secrets],
          );
          output += stepOutput;
        } catch (error: any) {
          const allowFailure = step.allowFailure === true;
          const stepName = step.name || step.image || 'unknown';

          if (allowFailure) {
            OrchestratorLogger.logWarning(
              `Hook container "${stepName}" failed but allowFailure is true. Continuing build. Error: ${
                error?.message || error
              }`,
            );

            // Continue to next step
          } else {
            OrchestratorLogger.log(
              `Hook container "${stepName}" failed and allowFailure is false (default). Stopping build.`,
            );
            throw error;
          }
        }
      }

      return output;
    } catch (error) {
      throw error;
    }
  }
}
