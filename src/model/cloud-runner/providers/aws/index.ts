import * as SDK from 'aws-sdk';
import CloudRunnerSecret from '../../options/cloud-runner-secret';
import CloudRunnerEnvironmentVariable from '../../options/cloud-runner-environment-variable';
import CloudRunnerAWSTaskDef from './cloud-runner-aws-task-def';
import AwsTaskRunner from './aws-task-runner';
import { ProviderInterface } from '../provider-interface';
import BuildParameters from '../../../build-parameters';
import CloudRunnerLogger from '../../services/core/cloud-runner-logger';
import { AWSJobStack as AwsJobStack } from './aws-job-stack';
import { AWSBaseStack as AwsBaseStack } from './aws-base-stack';
import { Input } from '../../..';
import { GarbageCollectionService } from './services/garbage-collection-service';
import { ProviderResource } from '../provider-resource';
import { ProviderWorkflow } from '../provider-workflow';
import { TaskService } from './services/task-service';
import CloudRunnerOptions from '../../options/cloud-runner-options';

class AWSBuildEnvironment implements ProviderInterface {
  private baseStackName: string;

  constructor(buildParameters: BuildParameters) {
    this.baseStackName = buildParameters.awsStackName;
  }
  async listResources(): Promise<ProviderResource[]> {
    await TaskService.getCloudFormationJobStacks();
    await TaskService.getLogGroups();
    await TaskService.getTasks();

    return [];
  }
  listWorkflow(): Promise<ProviderWorkflow[]> {
    throw new Error('Method not implemented.');
  }
  async watchWorkflow(): Promise<string> {
    return await TaskService.watch();
  }

  async listOtherResources(): Promise<string> {
    await TaskService.getLogGroups();

    return '';
  }

  async garbageCollect(
    filter: string,
    previewOnly: boolean,
    // eslint-disable-next-line no-unused-vars
    olderThan: Number,
    // eslint-disable-next-line no-unused-vars
    fullCache: boolean,
    // eslint-disable-next-line no-unused-vars
    baseDependencies: boolean,
  ): Promise<string> {
    await GarbageCollectionService.cleanup(!previewOnly);

    return ``;
  }

  async cleanupWorkflow(
    // eslint-disable-next-line no-unused-vars
    buildParameters: BuildParameters,
    // eslint-disable-next-line no-unused-vars
    branchName: string,
    // eslint-disable-next-line no-unused-vars
    defaultSecretsArray: { ParameterKey: string; EnvironmentVariable: string; ParameterValue: string }[],
  ) {}
  async setupWorkflow(
    // eslint-disable-next-line no-unused-vars
    buildGuid: string,
    // eslint-disable-next-line no-unused-vars
    buildParameters: BuildParameters,
    // eslint-disable-next-line no-unused-vars
    branchName: string,
    // eslint-disable-next-line no-unused-vars
    defaultSecretsArray: { ParameterKey: string; EnvironmentVariable: string; ParameterValue: string }[],
  ) {
    process.env.AWS_REGION = Input.region;
    const CF = new SDK.CloudFormation();
    await new AwsBaseStack(this.baseStackName).setupBaseStack(CF);
  }

  async runTaskInWorkflow(
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
    AwsTaskRunner.ECS = ECS;
    AwsTaskRunner.Kinesis = new SDK.Kinesis();
    CloudRunnerLogger.log(`AWS Region: ${CF.config.region}`);
    const entrypoint = ['/bin/sh'];
    const startTimeMs = Date.now();
    const taskDef = await new AwsJobStack(this.baseStackName).setupCloudFormations(
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
      const { output, shouldCleanup } = await AwsTaskRunner.runTask(taskDef, environment, commands);
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
      CloudRunnerLogger.log(`error running task ${error}`);
      await this.cleanupResources(CF, taskDef);
      throw error;
    }
  }

  async cleanupResources(CF: SDK.CloudFormation, taskDef: CloudRunnerAWSTaskDef) {
    CloudRunnerLogger.log('Cleanup starting');
    await CF.deleteStack({
      StackName: taskDef.taskDefStackName,
    }).promise();
    if (CloudRunnerOptions.useCleanupCron) {
      await CF.deleteStack({
        StackName: `${taskDef.taskDefStackName}-cleanup`,
      }).promise();
    }

    await CF.waitFor('stackDeleteComplete', {
      StackName: taskDef.taskDefStackName,
    }).promise();
    await CF.waitFor('stackDeleteComplete', {
      StackName: `${taskDef.taskDefStackName}-cleanup`,
    }).promise();
    CloudRunnerLogger.log(`Deleted Stack: ${taskDef.taskDefStackName}`);
    CloudRunnerLogger.log('Cleanup complete');
  }
}
export default AWSBuildEnvironment;
