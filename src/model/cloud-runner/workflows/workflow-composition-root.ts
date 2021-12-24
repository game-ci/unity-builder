import { CloudRunnerState } from '../state/cloud-runner-state';
import { CloudRunnerStepState } from '../state/cloud-runner-step-state';
import { DownloadStep } from '../steps/download-step';
import { CustomWorkflow } from './custom-workflow';
import { EphemeralGitHubRunnerWorkflow } from './ephemeral-github-runner-workflow';
import { WorkflowInterface } from './workflow-interface';
import * as core from '@actions/core';
import { BuildAutomationWorkflow } from './build-automation-workflow';

export class WorkflowCompositionRoot implements WorkflowInterface {
  async run(cloudRunnerStepState: CloudRunnerStepState) {
    try {
      await WorkflowCompositionRoot.runJob(cloudRunnerStepState.image.toString());
    } catch (error) {
      throw error;
    }
  }

  private static async runJob(baseImage: any) {
    try {
      core.info(
        `Remote envs ${JSON.stringify(
          CloudRunnerState.readBuildEnvironmentVariables(),
          undefined,
          4,
        )} Remote secrets ${JSON.stringify(CloudRunnerState.defaultSecrets, undefined, 4)}`,
      );
      core.info(`Custom build steps: ${CloudRunnerState.buildParams.customBuildSteps}`);
      if (CloudRunnerState.buildParams.customBuildSteps === '') {
        await new BuildAutomationWorkflow().run(
          new CloudRunnerStepState(
            baseImage,
            CloudRunnerState.readBuildEnvironmentVariables(),
            CloudRunnerState.defaultSecrets,
          ),
        );
      } else if (CloudRunnerState.buildParams.customBuildSteps === 'ephemeral') {
        await new EphemeralGitHubRunnerWorkflow().run(
          new CloudRunnerStepState(
            baseImage,
            CloudRunnerState.readBuildEnvironmentVariables(),
            CloudRunnerState.defaultSecrets,
          ),
        );
      } else if (CloudRunnerState.buildParams.customBuildSteps === 'download') {
        await new DownloadStep().run(
          new CloudRunnerStepState(
            'alpine/git',
            CloudRunnerState.readBuildEnvironmentVariables(),
            CloudRunnerState.defaultSecrets,
          ),
        );
      } else {
        await CustomWorkflow.runCustomJob(CloudRunnerState.buildParams.customBuildSteps);
      }
    } catch (error) {
      throw error;
    }
  }
}
