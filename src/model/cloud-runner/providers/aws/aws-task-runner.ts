import * as AWS from 'aws-sdk';
import CloudRunnerEnvironmentVariable from '../../services/cloud-runner-environment-variable.ts';
import * as core from '../../../node_modules/@actions/core';
import CloudRunnerAWSTaskDef from './cloud-runner-aws-task-def.ts';
import * as zlib from '../../../node_modules/zlib';
import CloudRunnerLogger from '../../services/cloud-runner-logger.ts';
import { Input } from '../../...ts';
import CloudRunner from '../../cloud-runner.ts';
import { CloudRunnerBuildCommandProcessor } from '../../services/cloud-runner-build-command-process.ts';
import { FollowLogStreamService } from '../../services/follow-log-stream-service.ts';

class AWSTaskRunner {
  static async runTask(
    taskDef: CloudRunnerAWSTaskDef,
    ECS: AWS.ECS,
    CF: AWS.CloudFormation,
    environment: CloudRunnerEnvironmentVariable[],
    buildGuid: string,
    commands: string,
  ) {
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

    const task = await ECS.runTask({
      cluster,
      taskDefinition,
      platformVersion: '1.4.0',
      overrides: {
        containerOverrides: [
          {
            name: taskDef.taskDefStackName,
            environment,
            command: ['-c', CloudRunnerBuildCommandProcessor.ProcessCommands(commands, CloudRunner.buildParameters)],
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
    await AWSTaskRunner.waitUntilTaskRunning(ECS, taskArn, cluster);
    CloudRunnerLogger.log(
      `Cloud runner job status is running ${(await AWSTaskRunner.describeTasks(ECS, cluster, taskArn))?.lastStatus}`,
    );
    const { output, shouldCleanup } = await this.streamLogsUntilTaskStops(
      ECS,
      CF,
      taskDef,
      cluster,
      taskArn,
      streamName,
    );
    const taskData = await AWSTaskRunner.describeTasks(ECS, cluster, taskArn);
    const exitCode = taskData.containers?.[0].exitCode;
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

  private static async waitUntilTaskRunning(ECS: AWS.ECS, taskArn: string, cluster: string) {
    try {
      await ECS.waitFor('tasksRunning', { tasks: [taskArn], cluster }).promise();
    } catch (error_) {
      const error = error_ as Error;
      await new Promise((resolve) => setTimeout(resolve, 3000));
      CloudRunnerLogger.log(
        `Cloud runner job has ended ${
          (await AWSTaskRunner.describeTasks(ECS, cluster, taskArn)).containers?.[0].lastStatus
        }`,
      );

      core.setFailed(error);
      core.error(error);
    }
  }

  static async describeTasks(ECS: AWS.ECS, clusterName: string, taskArn: string) {
    const tasks = await ECS.describeTasks({
      cluster: clusterName,
      tasks: [taskArn],
    }).promise();
    if (tasks.tasks?.[0]) {
      return tasks.tasks?.[0];
    } else {
      throw new Error('No task found');
    }
  }

  static async streamLogsUntilTaskStops(
    ECS: AWS.ECS,
    CF: AWS.CloudFormation,
    taskDef: CloudRunnerAWSTaskDef,
    clusterName: string,
    taskArn: string,
    kinesisStreamName: string,
  ) {
    const kinesis = new AWS.Kinesis();
    const stream = await AWSTaskRunner.getLogStream(kinesis, kinesisStreamName);
    let iterator = await AWSTaskRunner.getLogIterator(kinesis, stream);

    const logBaseUrl = `https://${Input.region}.console.aws.amazon.com/cloudwatch/home?region=${Input.region}#logsV2:log-groups/log-group/${CloudRunner.buildParameters.awsBaseStackName}-${CloudRunner.buildParameters.buildGuid}`;
    CloudRunnerLogger.log(`You view the log stream on AWS Cloud Watch: ${logBaseUrl}`);
    let shouldReadLogs = true;
    let shouldCleanup = true;
    let timestamp: number = 0;
    let output = '';
    while (shouldReadLogs) {
      await new Promise((resolve) => setTimeout(resolve, 1500));
      const taskData = await AWSTaskRunner.describeTasks(ECS, clusterName, taskArn);
      ({ timestamp, shouldReadLogs } = AWSTaskRunner.checkStreamingShouldContinue(taskData, timestamp, shouldReadLogs));
      ({ iterator, shouldReadLogs, output, shouldCleanup } = await AWSTaskRunner.handleLogStreamIteration(
        kinesis,
        iterator,
        shouldReadLogs,
        taskDef,
        output,
        shouldCleanup,
      ));
    }

    return { output, shouldCleanup };
  }

  private static async handleLogStreamIteration(
    kinesis: AWS.Kinesis,
    iterator: string,
    shouldReadLogs: boolean,
    taskDef: CloudRunnerAWSTaskDef,
    output: string,
    shouldCleanup: boolean,
  ) {
    const records = await kinesis
      .getRecords({
        ShardIterator: iterator,
      })
      .promise();
    iterator = records.NextShardIterator || '';
    ({ shouldReadLogs, output, shouldCleanup } = AWSTaskRunner.logRecords(
      records,
      iterator,
      taskDef,
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
    taskDef: CloudRunnerAWSTaskDef,
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

  private static async getLogStream(kinesis: AWS.Kinesis, kinesisStreamName: string) {
    return await kinesis
      .describeStream({
        StreamName: kinesisStreamName,
      })
      .promise();
  }

  private static async getLogIterator(kinesis: AWS.Kinesis, stream) {
    return (
      (
        await kinesis
          .getShardIterator({
            ShardIteratorType: 'TRIM_HORIZON',
            StreamName: stream.StreamDescription.StreamName,
            ShardId: stream.StreamDescription.Shards[0].ShardId,
          })
          .promise()
      ).ShardIterator || ''
    );
  }
}
export default AWSTaskRunner;
