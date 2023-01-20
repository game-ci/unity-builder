import * as AWS from 'aws-sdk';
import CloudRunnerEnvironmentVariable from '../../services/cloud-runner-environment-variable';
import * as core from '@actions/core';
import CloudRunnerAWSTaskDef from './cloud-runner-aws-task-def';
import * as zlib from 'zlib';
import CloudRunnerLogger from '../../services/cloud-runner-logger';
import { Input } from '../../..';
import CloudRunner from '../../cloud-runner';
import { CloudRunnerCustomHooks } from '../../services/cloud-runner-custom-hooks';
import { FollowLogStreamService } from '../../services/follow-log-stream-service';
import CloudRunnerOptions from '../../cloud-runner-options';
import GitHub from '../../../github';

class AWSTaskRunner {
  public static ECS: AWS.ECS;
  public static Kinesis: AWS.Kinesis;
  private static readonly encodedUnderscore = `$252F`;
  static async runTask(
    taskDef: CloudRunnerAWSTaskDef,
    environment: CloudRunnerEnvironmentVariable[],
    commands: string,
  ): Promise<{ output: string; shouldCleanup: boolean }> {
    const cluster = taskDef.baseResources?.find((x) => x.LogicalResourceId === 'ECSCluster')?.PhysicalResourceId || '';
    const taskDefinition =
      taskDef.taskDefResources?.find((x) => x.LogicalResourceId === 'TaskDefinition')?.PhysicalResourceId || '';
    const SubnetOne =
      taskDef.baseResources?.find((x) => x.LogicalResourceId === 'PublicSubnetOne')?.PhysicalResourceId || '';
    const SubnetTwo =
      taskDef.baseResources?.find((x) => x.LogicalResourceId === 'PublicSubnetTwo')?.PhysicalResourceId || '';
    const ContainerSecurityGroup =
      taskDef.baseResources?.find((x) => x.LogicalResourceId === 'ContainerSecurityGroup')?.PhysicalResourceId || '';
    const streamName =
      taskDef.taskDefResources?.find((x) => x.LogicalResourceId === 'KinesisStream')?.PhysicalResourceId || '';

    const task = await AWSTaskRunner.ECS.runTask({
      cluster,
      taskDefinition,
      platformVersion: '1.4.0',
      overrides: {
        containerOverrides: [
          {
            name: taskDef.taskDefStackName,
            environment,
            command: ['-c', CloudRunnerCustomHooks.ApplyHooksToCommands(commands, CloudRunner.buildParameters)],
          },
        ],
      },
      launchType: 'FARGATE',
      networkConfiguration: {
        awsvpcConfiguration: {
          subnets: [SubnetOne, SubnetTwo],
          assignPublicIp: 'ENABLED',
          securityGroups: [ContainerSecurityGroup],
        },
      },
    }).promise();
    const taskArn = task.tasks?.[0].taskArn || '';
    CloudRunnerLogger.log('Cloud runner job is starting');
    await AWSTaskRunner.waitUntilTaskRunning(taskArn, cluster);
    CloudRunnerLogger.log(
      `Cloud runner job status is running ${(await AWSTaskRunner.describeTasks(cluster, taskArn))?.lastStatus} Watch:${
        CloudRunnerOptions.watchCloudRunnerToEnd
      } Async:${CloudRunnerOptions.asyncCloudRunner}`,
    );
    if (!CloudRunnerOptions.watchCloudRunnerToEnd) {
      const shouldCleanup: boolean = false;
      const output: string = '';
      CloudRunnerLogger.log(`Watch Cloud Runner To End: false`);

      return { output, shouldCleanup };
    }

    CloudRunnerLogger.log(`Streaming...`);
    const { output, shouldCleanup } = await this.streamLogsUntilTaskStops(cluster, taskArn, streamName);
    await new Promise((resolve) => resolve(5000));
    const taskData = await AWSTaskRunner.describeTasks(cluster, taskArn);
    const containerState = taskData.containers?.[0];
    const exitCode = containerState?.exitCode || undefined;
    CloudRunnerLogger.log(`Container State: ${JSON.stringify(containerState, undefined, 4)}`);
    const wasSuccessful = exitCode === 0 || (exitCode === undefined && taskData.lastStatus === 'RUNNING');
    if (wasSuccessful) {
      CloudRunnerLogger.log(`Cloud runner job has finished successfully`);

      return { output, shouldCleanup };
    } else {
      if (taskData.stoppedReason === 'Essential container in task exited' && exitCode === 1) {
        throw new Error('Container exited with code 1');
      }
      const message = `Cloud runner job exit code ${exitCode}`;
      taskData.overrides = undefined;
      taskData.attachments = undefined;
      CloudRunnerLogger.log(`${message} ${JSON.stringify(taskData, undefined, 4)}`);
      throw new Error(message);
    }
  }

  private static async waitUntilTaskRunning(taskArn: string, cluster: string) {
    try {
      await AWSTaskRunner.ECS.waitFor('tasksRunning', { tasks: [taskArn], cluster }).promise();
    } catch (error_) {
      const error = error_ as Error;
      await new Promise((resolve) => setTimeout(resolve, 3000));
      CloudRunnerLogger.log(
        `Cloud runner job has ended ${
          (await AWSTaskRunner.describeTasks(cluster, taskArn)).containers?.[0].lastStatus
        }`,
      );

      core.setFailed(error);
      core.error(error);
    }
  }

  static async describeTasks(clusterName: string, taskArn: string) {
    const tasks = await AWSTaskRunner.ECS.describeTasks({
      cluster: clusterName,
      tasks: [taskArn],
    }).promise();
    if (tasks.tasks?.[0]) {
      return tasks.tasks?.[0];
    } else {
      throw new Error('No task found');
    }
  }

  static async streamLogsUntilTaskStops(clusterName: string, taskArn: string, kinesisStreamName: string) {
    await new Promise((resolve) => setTimeout(resolve, 3000));
    CloudRunnerLogger.log(`Streaming...`);
    const stream = await AWSTaskRunner.getLogStream(kinesisStreamName);
    let iterator = await AWSTaskRunner.getLogIterator(stream);

    const logBaseUrl = `https://${Input.region}.console.aws.amazon.com/cloudwatch/home?region=${Input.region}#logsV2:log-groups/log-group/${CloudRunner.buildParameters.awsBaseStackName}${AWSTaskRunner.encodedUnderscore}${CloudRunner.buildParameters.awsBaseStackName}-${CloudRunner.buildParameters.buildGuid}`;
    CloudRunnerLogger.log(`You view the log stream on AWS Cloud Watch: ${logBaseUrl}`);
    await GitHub.updateGitHubCheck(`You view the log stream on AWS Cloud Watch:  ${logBaseUrl}`, ``);
    let shouldReadLogs = true;
    let shouldCleanup = true;
    let timestamp: number = 0;
    let output = '';
    while (shouldReadLogs) {
      await new Promise((resolve) => setTimeout(resolve, 1500));
      const taskData = await AWSTaskRunner.describeTasks(clusterName, taskArn);
      ({ timestamp, shouldReadLogs } = AWSTaskRunner.checkStreamingShouldContinue(taskData, timestamp, shouldReadLogs));
      ({ iterator, shouldReadLogs, output, shouldCleanup } = await AWSTaskRunner.handleLogStreamIteration(
        iterator,
        shouldReadLogs,
        output,
        shouldCleanup,
      ));
    }

    return { output, shouldCleanup };
  }

  private static async handleLogStreamIteration(
    iterator: string,
    shouldReadLogs: boolean,
    output: string,
    shouldCleanup: boolean,
  ) {
    const records = await AWSTaskRunner.Kinesis.getRecords({
      ShardIterator: iterator,
    }).promise();
    iterator = records.NextShardIterator || '';
    ({ shouldReadLogs, output, shouldCleanup } = AWSTaskRunner.logRecords(
      records,
      iterator,
      shouldReadLogs,
      output,
      shouldCleanup,
    ));

    return { iterator, shouldReadLogs, output, shouldCleanup };
  }

  private static checkStreamingShouldContinue(taskData: AWS.ECS.Task, timestamp: number, shouldReadLogs: boolean) {
    if (taskData?.lastStatus === 'UNKNOWN') {
      CloudRunnerLogger.log('## Cloud runner job unknwon');
    }
    if (taskData?.lastStatus !== 'RUNNING') {
      if (timestamp === 0) {
        CloudRunnerLogger.log('## Cloud runner job stopped, streaming end of logs');
        timestamp = Date.now();
      }
      if (timestamp !== 0 && Date.now() - timestamp > 30000) {
        CloudRunnerLogger.log('## Cloud runner status is not RUNNING for 30 seconds, last query for logs');
        shouldReadLogs = false;
      }
      CloudRunnerLogger.log(`## Status of job: ${taskData.lastStatus}`);
    }

    return { timestamp, shouldReadLogs };
  }

  private static logRecords(
    records,
    iterator: string,
    shouldReadLogs: boolean,
    output: string,
    shouldCleanup: boolean,
  ) {
    if (records.Records.length > 0 && iterator) {
      for (let index = 0; index < records.Records.length; index++) {
        const json = JSON.parse(
          zlib.gunzipSync(Buffer.from(records.Records[index].Data as string, 'base64')).toString('utf8'),
        );
        if (json.messageType === 'DATA_MESSAGE') {
          for (let logEventsIndex = 0; logEventsIndex < json.logEvents.length; logEventsIndex++) {
            const message = json.logEvents[logEventsIndex].message;
            ({ shouldReadLogs, shouldCleanup, output } = FollowLogStreamService.handleIteration(
              message,
              shouldReadLogs,
              shouldCleanup,
              output,
            ));
          }
        }
      }
    }

    return { shouldReadLogs, output, shouldCleanup };
  }

  private static async getLogStream(kinesisStreamName: string) {
    return await AWSTaskRunner.Kinesis.describeStream({
      StreamName: kinesisStreamName,
    }).promise();
  }

  private static async getLogIterator(stream) {
    return (
      (
        await AWSTaskRunner.Kinesis.getShardIterator({
          ShardIteratorType: 'TRIM_HORIZON',
          StreamName: stream.StreamDescription.StreamName,
          ShardId: stream.StreamDescription.Shards[0].ShardId,
        }).promise()
      ).ShardIterator || ''
    );
  }
}
export default AWSTaskRunner;
