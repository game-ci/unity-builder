import * as SDK from 'aws-sdk';
import CloudRunnerSecret from '../../services/cloud-runner-secret';
import CloudRunnerEnvironmentVariable from '../../services/cloud-runner-environment-variable';
import CloudRunnerAWSTaskDef from './cloud-runner-aws-task-def';
import AwsTaskRunner from './aws-task-runner';
import { ProviderInterface } from '../provider-interface';
import BuildParameters from '../../../build-parameters';
import CloudRunnerLogger from '../../services/cloud-runner-logger';
import { AWSJobStack as AwsJobStack } from './aws-job-stack';
import { AWSBaseStack as AwsBaseStack } from './aws-base-stack';
import { Input } from '../../..';
import { AwsCliCommands } from './commands/aws-cli-commands';
import { TertiaryResourcesService } from './services/tertiary-resources-service';
import { TaskService } from './services/task-service';
import { GarbageCollectionService } from './services/garbage-collection-service';

class AWSBuildEnvironment implements ProviderInterface {
  private baseStackName: string;

  constructor(buildParameters: BuildParameters) {
    this.baseStackName = buildParameters.awsBaseStackName;
  }
  async inspectResources(): Promise<string> {
    return await TaskService.awsDescribeJob('');
  }
  async watchWorkflow(): Promise<string> {
    // eslint-disable-next-line no-unused-vars
    const { output, shouldCleanup } = await AwsTaskRunner.streamLogsUntilTaskStops(
      process.env.cluster || ``,
      process.env.taskArn || ``,
      process.env.streamName || ``,
    );

    return output;
  }

  async listOtherResources(): Promise<string> {
    await TertiaryResourcesService.AwsListLogGroups();

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

  async listResources() {
    await AwsCliCommands.awsListStacks();
    await AwsCliCommands.awsListTasks();
    await AwsCliCommands.awsListLogGroups();

    return '';
  }

  async cleanupWorkflow(
    // eslint-disable-next-line no-unused-vars
    buildGuid: string,
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
  ) {}

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

    await new AwsBaseStack(this.baseStackName).setupBaseStack(CF);
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
