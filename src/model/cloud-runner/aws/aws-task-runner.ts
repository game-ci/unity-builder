import * as AWS from 'aws-sdk';
import CloudRunnerEnvironmentVariable from '../services/cloud-runner-environment-variable';
import * as core from '@actions/core';
import CloudRunnerAWSTaskDef from './cloud-runner-aws-task-def';
import * as zlib from 'zlib';
import CloudRunnerLogger from '../services/cloud-runner-logger';
import { Input } from '../..';
import { CloudRunnerState } from '../state/cloud-runner-state';
import { CloudRunnerStatics } from '../cloud-runner-statics';
import { CloudRunnerBuildCommandProcessor } from '../services/cloud-runner-build-command-process';

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
            command: ['-c', CloudRunnerBuildCommandProcessor.ProcessCommands(commands, CloudRunnerState.buildParams)],
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

    CloudRunnerLogger.log('Cloud runner job is starting');
    const taskArn = task.tasks?.[0].taskArn || '';

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
    CloudRunnerLogger.log(`Cloud runner job is running`);

    const output = await this.streamLogsUntilTaskStops(ECS, CF, taskDef, cluster, taskArn, streamName);
    const exitCode = (await AWSTaskRunner.describeTasks(ECS, cluster, taskArn)).containers?.[0].exitCode;
    CloudRunnerLogger.log(`Cloud runner job exit code ${exitCode}`);
    if (exitCode !== 0 && exitCode !== undefined) {
      core.error(
        `job failed with exit code ${exitCode} ${JSON.stringify(
          await ECS.describeTasks({ tasks: [taskArn], cluster }).promise(),
          undefined,
          4,
        )}`,
      );
      throw new Error(`job failed with exit code ${exitCode}`);
    } else {
      CloudRunnerLogger.log(`Cloud runner job has finished successfully`);
      return output;
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

    CloudRunnerLogger.log(
      `Cloud runner job status is ${(await AWSTaskRunner.describeTasks(ECS, clusterName, taskArn))?.lastStatus}`,
    );

    const logBaseUrl = `https://${Input.region}.console.aws.amazon.com/cloudwatch/home?region=${AWS.config.region}#logsV2:log-groups/log-group/${taskDef.taskDefStackName}`;
    CloudRunnerLogger.log(`You can also see the logs at AWS Cloud Watch: ${logBaseUrl}`);
    let shouldReadLogs = true;
    let timestamp: number = 0;
    let output = '';
    while (shouldReadLogs) {
      await new Promise((resolve) => setTimeout(resolve, 1500));
      const taskData = await AWSTaskRunner.describeTasks(ECS, clusterName, taskArn);
      ({ timestamp, shouldReadLogs } = AWSTaskRunner.checkStreamingShouldContinue(taskData, timestamp, shouldReadLogs));
      ({ iterator, shouldReadLogs, output } = await AWSTaskRunner.handleLogStreamIteration(
        kinesis,
        iterator,
        shouldReadLogs,
        taskDef,
        output,
      ));
    }
    return output;
  }

  private static async handleLogStreamIteration(
    kinesis: AWS.Kinesis,
    iterator: string,
    shouldReadLogs: boolean,
    taskDef: CloudRunnerAWSTaskDef,
    output: string,
  ) {
    const records = await kinesis
      .getRecords({
        ShardIterator: iterator,
      })
      .promise();
    iterator = records.NextShardIterator || '';
    ({ shouldReadLogs, output } = AWSTaskRunner.logRecords(records, iterator, taskDef, shouldReadLogs, output));
    return { iterator, shouldReadLogs, output };
  }

  private static checkStreamingShouldContinue(taskData: AWS.ECS.Task, timestamp: number, shouldReadLogs: boolean) {
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
  ) {
    if (records.Records.length > 0 && iterator) {
      for (let index = 0; index < records.Records.length; index++) {
        const json = JSON.parse(
          zlib.gunzipSync(Buffer.from(records.Records[index].Data as string, 'base64')).toString('utf8'),
        );
        if (json.messageType === 'DATA_MESSAGE') {
          for (let logEventsIndex = 0; logEventsIndex < json.logEvents.length; logEventsIndex++) {
            let message = json.logEvents[logEventsIndex].message;
            if (json.logEvents[logEventsIndex].message.includes(`---${CloudRunnerState.buildParams.logId}`)) {
              CloudRunnerLogger.log('End of log transmission received');
              shouldReadLogs = false;
            } else if (message.includes('Rebuilding Library because the asset database could not be found!')) {
              core.warning('LIBRARY NOT FOUND!');
            }
            message = `[${CloudRunnerStatics.logPrefix}] ${message}`;
            if (Input.cloudRunnerTests) {
              output += message;
            }
            CloudRunnerLogger.log(message);
          }
        }
      }
    }
    return { shouldReadLogs, output };
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
