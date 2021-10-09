import { CloudRunnerState } from '../state/cloud-runner-state';
import { CloudRunnerStepState } from '../state/cloud-runner-step-state';
import { DownloadRepositoryStep } from '../steps/download-repository-step';
import { CustomWorkflow } from './custom-workflow';
import { EphemeralGitHubRunnerWorkflow } from './ephemeral-github-runner-workflow';
import { WorkflowInterface } from './workflow-interface';
import * as core from '@actions/core';
import { BuildAutomationWorkflow } from './build-automation-workflow';

export class WorkflowCompositionRoot implements WorkflowInterface {
  async run(cloudRunnerStepState: CloudRunnerStepState) {
    await WorkflowCompositionRoot.runJob(cloudRunnerStepState.image.toString());
  }

  private static async runJob(baseImage: any) {
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
      await new DownloadRepositoryStep().run(
        new CloudRunnerStepState(
          'alpine/git',
          CloudRunnerState.readBuildEnvironmentVariables(),
          CloudRunnerState.defaultSecrets,
        ),
      );
    } else {
      await CustomWorkflow.runCustomJob(CloudRunnerState.buildParams.customBuildSteps);
    }
  }
}
