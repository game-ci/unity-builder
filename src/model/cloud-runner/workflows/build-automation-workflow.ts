import CloudRunnerLogger from '../services/cloud-runner-logger';
import { TaskParameterSerializer } from '../services/task-parameter-serializer';
import { CloudRunnerState } from '../state/cloud-runner-state';
import { CloudRunnerStepState } from '../state/cloud-runner-step-state';
import { BuildStep } from '../steps/build-step';
import { SetupStep } from '../steps/setup-step';
import { CustomWorkflow } from './custom-workflow';
import { WorkflowInterface } from './workflow-interface';
import * as core from '@actions/core';

export class BuildAutomationWorkflow implements WorkflowInterface {
  async run(cloudRunnerStepState: CloudRunnerStepState) {
    try {
      return await BuildAutomationWorkflow.standardBuildAutomation(cloudRunnerStepState.image);
    } catch (error) {
      throw error;
    }
  }

  private static async standardBuildAutomation(baseImage: any) {
    try {
      CloudRunnerLogger.log(`Cloud Runner is running standard build automation`);
      let output = '';
      if (CloudRunnerState.buildParams.preBuildSteps !== '') {
        output += await CustomWorkflow.runCustomJob(CloudRunnerState.buildParams.preBuildSteps);
      }
      CloudRunnerLogger.logWithTime('Configurable pre build step(s) time');

      core.startGroup('setup');
      output += await new SetupStep().run(
        new CloudRunnerStepState(
          'alpine/git',
          TaskParameterSerializer.readBuildEnvironmentVariables(),
          CloudRunnerState.defaultSecrets,
        ),
      );
      CloudRunnerLogger.logWithTime('Download repository step time');

      core.startGroup('build');
      output += await new BuildStep().run(
        new CloudRunnerStepState(
          baseImage,
          TaskParameterSerializer.readBuildEnvironmentVariables(),
          CloudRunnerState.defaultSecrets,
        ),
      );
      CloudRunnerLogger.logWithTime('Build time');

      if (CloudRunnerState.buildParams.postBuildSteps !== '') {
        output += await CustomWorkflow.runCustomJob(CloudRunnerState.buildParams.postBuildSteps);
      }
      CloudRunnerLogger.logWithTime('Configurable post build step(s) time');

      CloudRunnerLogger.log(`Cloud Runner finished running standard build automation`);

      return output;
    } catch (error) {
      throw error;
    }
  }
}
