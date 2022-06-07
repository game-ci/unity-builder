import * as SDK from 'aws-sdk';
import CloudRunnerSecret from '../../services/cloud-runner-secret.ts';
import CloudRunnerEnvironmentVariable from '../../services/cloud-runner-environment-variable.ts';
import CloudRunnerAWSTaskDef from './cloud-runner-aws-task-def.ts';
import AWSTaskRunner from './aws-task-runner.ts';
import { ProviderInterface } from '../provider-interface.ts';
import BuildParameters from '../../../build-parameters.ts';
import CloudRunnerLogger from '../../services/cloud-runner-logger.ts';
import { AWSJobStack } from './aws-job-stack.ts';
import { AWSBaseStack } from './aws-base-stack.ts';
import { Input } from '../../...ts';

class AWSBuildEnvironment implements ProviderInterface {
  private baseStackName: string;

  constructor(buildParameters: BuildParameters) {
    this.baseStackName = buildParameters.awsBaseStackName;
  }
  async cleanup(
    // eslint-disable-next-line no-unused-vars
    buildGuid: string,
    // eslint-disable-next-line no-unused-vars
    buildParameters: BuildParameters,
    // eslint-disable-next-line no-unused-vars
    branchName: string,
    // eslint-disable-next-line no-unused-vars
    defaultSecretsArray: { ParameterKey: string; EnvironmentVariable: string; ParameterValue: string }[],
  ) {}
  async setup(
    // eslint-disable-next-line no-unused-vars
    buildGuid: string,
    // eslint-disable-next-line no-unused-vars
    buildParameters: BuildParameters,
    // eslint-disable-next-line no-unused-vars
    branchName: string,
    // eslint-disable-next-line no-unused-vars
    defaultSecretsArray: { ParameterKey: string; EnvironmentVariable: string; ParameterValue: string }[],
  ) {}

  async runTask(
    buildGuid: string,
    image: string,
    commands: string,
    mountdir: string,
    workingdir: string,
    environment: CloudRunnerEnvironmentVariable[],
    secrets: CloudRunnerSecret[],
  ): Promise<string> {
    process.env.AWS_REGION = Input.region;
    const ECS = new SDK.ECS();
    const CF = new SDK.CloudFormation();
    CloudRunnerLogger.log(`AWS Region: ${CF.config.region}`);
    const entrypoint = ['/bin/sh'];
    const startTimeMs = Date.now();

    await new AWSBaseStack(this.baseStackName).setupBaseStack(CF);
    const taskDef = await new AWSJobStack(this.baseStackName).setupCloudFormations(
      CF,
      buildGuid,
      image,
      entrypoint,
      commands,
      mountdir,
      workingdir,
      secrets,
    );

    let postRunTaskTimeMs;
    try {
      const postSetupStacksTimeMs = Date.now();
      CloudRunnerLogger.log(`Setup job time: ${Math.floor((postSetupStacksTimeMs - startTimeMs) / 1000)}s`);
      const { output, shouldCleanup } = await AWSTaskRunner.runTask(taskDef, ECS, CF, environment, buildGuid, commands);
      postRunTaskTimeMs = Date.now();
      CloudRunnerLogger.log(`Run job time: ${Math.floor((postRunTaskTimeMs - postSetupStacksTimeMs) / 1000)}s`);
      if (shouldCleanup) {
        await this.cleanupResources(CF, taskDef);
      }
      const postCleanupTimeMs = Date.now();
      if (postRunTaskTimeMs !== undefined)
        CloudRunnerLogger.log(`Cleanup job time: ${Math.floor((postCleanupTimeMs - postRunTaskTimeMs) / 1000)}s`);

      return output;
    } catch (error) {
      await this.cleanupResources(CF, taskDef);
      throw error;
    }
  }

  async cleanupResources(CF: SDK.CloudFormation, taskDef: CloudRunnerAWSTaskDef) {
    CloudRunnerLogger.log('Cleanup starting');
    await CF.deleteStack({
      StackName: taskDef.taskDefStackName,
    }).promise();

    await CF.waitFor('stackDeleteComplete', {
      StackName: taskDef.taskDefStackName,
    }).promise();
    CloudRunnerLogger.log(`Deleted Stack: ${taskDef.taskDefStackName}`);
    CloudRunnerLogger.log('Cleanup complete');
  }
}
export default AWSBuildEnvironment;
