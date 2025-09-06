import { DescribeTasksCommand, RunTaskCommand, waitUntilTasksRunning } from '@aws-sdk/client-ecs';
import { DescribeStreamCommand, GetRecordsCommand, GetShardIteratorCommand } from '@aws-sdk/client-kinesis';
import CloudRunnerEnvironmentVariable from '../../options/cloud-runner-environment-variable';
import * as core from '@actions/core';
import CloudRunnerAWSTaskDef from './cloud-runner-aws-task-def';
import * as zlib from 'node:zlib';
import CloudRunnerLogger from '../../services/core/cloud-runner-logger';
import { Input } from '../../..';
import CloudRunner from '../../cloud-runner';
import { CommandHookService } from '../../services/hooks/command-hook-service';
import { FollowLogStreamService } from '../../services/core/follow-log-stream-service';
import CloudRunnerOptions from '../../options/cloud-runner-options';
import GitHub from '../../../github';
import { AwsClientFactory } from './aws-client-factory';

class AWSTaskRunner {
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

    const runParameters = {
      cluster,
      taskDefinition,
      platformVersion: '1.4.0',
      overrides: {
        containerOverrides: [
          {
            name: taskDef.taskDefStackName,
            environment,
            command: ['-c', CommandHookService.ApplyHooksToCommands(commands, CloudRunner.buildParameters)],
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
    };

    if (JSON.stringify(runParameters.overrides.containerOverrides).length > 8192) {
      CloudRunnerLogger.log(JSON.stringify(runParameters.overrides.containerOverrides, undefined, 4));
      throw new Error(`Container Overrides length must be at most 8192`);
    }

    const task = await AwsClientFactory.getECS().send(new RunTaskCommand(runParameters as any));
    const taskArn = task.tasks?.[0].taskArn || '';
    CloudRunnerLogger.log('Cloud runner job is starting');
    await AWSTaskRunner.waitUntilTaskRunning(taskArn, cluster);
    CloudRunnerLogger.log(
      `Cloud runner job status is running ${(await AWSTaskRunner.describeTasks(cluster, taskArn))?.lastStatus} Async:${
        CloudRunnerOptions.asyncCloudRunner
      }`,
    );
    if (CloudRunnerOptions.asyncCloudRunner) {
      const shouldCleanup: boolean = false;
      const output: string = '';
      CloudRunnerLogger.log(`Watch Cloud Runner To End: false`);

      return { output, shouldCleanup };
    }

    CloudRunnerLogger.log(`Streaming...`);
    const { output, shouldCleanup } = await this.streamLogsUntilTaskStops(cluster, taskArn, streamName);
    let exitCode;
    let containerState;
    let taskData;
    while (exitCode === undefined) {
      await new Promise((resolve) => resolve(10000));
      taskData = await AWSTaskRunner.describeTasks(cluster, taskArn);
      const containers = taskData?.containers as any[] | undefined;
      if (!containers || containers.length === 0) {
        continue;
      }
      containerState = containers[0];
      exitCode = containerState?.exitCode;
    }
    CloudRunnerLogger.log(`Container State: ${JSON.stringify(containerState, undefined, 4)}`);
    if (exitCode === undefined) {
      CloudRunnerLogger.logWarning(`Undefined exitcode for container`);
    }
    const wasSuccessful = exitCode === 0;
    if (wasSuccessful) {
      CloudRunnerLogger.log(`Cloud runner job has finished successfully`);

      return { output, shouldCleanup };
    }

    if (taskData?.stoppedReason === 'Essential container in task exited' && exitCode === 1) {
      throw new Error('Container exited with code 1');
    }

    throw new Error(`Task failed`);
  }

  private static async waitUntilTaskRunning(taskArn: string, cluster: string) {
    try {
      await waitUntilTasksRunning(
        {
          client: AwsClientFactory.getECS(),
          maxWaitTime: 120,
        },
        { tasks: [taskArn], cluster },
      );
    } catch (error_) {
      const error = error_ as Error;
      await new Promise((resolve) => setTimeout(resolve, 3000));
      const taskAfterError = await AWSTaskRunner.describeTasks(cluster, taskArn);
      CloudRunnerLogger.log(`Cloud runner job has ended ${taskAfterError?.containers?.[0]?.lastStatus}`);

      core.setFailed(error);
      core.error(error);
    }
  }

  static async describeTasks(clusterName: string, taskArn: string) {
    const maxAttempts = 10;
    let delayMs = 1000;
    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      try {
        const tasks = await AwsClientFactory.getECS().send(
          new DescribeTasksCommand({ cluster: clusterName, tasks: [taskArn] }),
        );
        if (tasks.tasks?.[0]) {
          return tasks.tasks?.[0];
        }
        throw new Error('No task found');
      } catch (error: any) {
        const isThrottle = error?.name === 'ThrottlingException' || /rate exceeded/i.test(String(error?.message));
        if (!isThrottle || attempt === maxAttempts) {
          throw error;
        }
        CloudRunnerLogger.log(
          `AWS throttled DescribeTasks (attempt ${attempt}/${maxAttempts}), backing off ${delayMs}ms`,
        );
        await new Promise((r) => setTimeout(r, delayMs));
        delayMs *= 2;
      }
    }
  }

  static async streamLogsUntilTaskStops(clusterName: string, taskArn: string, kinesisStreamName: string) {
    await new Promise((resolve) => setTimeout(resolve, 3000));
    CloudRunnerLogger.log(`Streaming...`);
    const stream = await AWSTaskRunner.getLogStream(kinesisStreamName);
    let iterator = await AWSTaskRunner.getLogIterator(stream);

    const logBaseUrl = `https://${Input.region}.console.aws.amazon.com/cloudwatch/home?region=${Input.region}#logsV2:log-groups/log-group/${CloudRunner.buildParameters.awsStackName}${AWSTaskRunner.encodedUnderscore}${CloudRunner.buildParameters.awsStackName}-${CloudRunner.buildParameters.buildGuid}`;
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
    let records: any;
    try {
      records = await AwsClientFactory.getKinesis().send(new GetRecordsCommand({ ShardIterator: iterator }));
    } catch (error: any) {
      const isThrottle = error?.name === 'ThrottlingException' || /rate exceeded/i.test(String(error?.message));
      if (isThrottle) {
        CloudRunnerLogger.log(`AWS throttled GetRecords, backing off 1000ms`);
        await new Promise((r) => setTimeout(r, 1000));

        return { iterator, shouldReadLogs, output, shouldCleanup };
      }
      throw error;
    }
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

  private static checkStreamingShouldContinue(taskData: any, timestamp: number, shouldReadLogs: boolean) {
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
    records: any,
    iterator: string,
    shouldReadLogs: boolean,
    output: string,
    shouldCleanup: boolean,
  ) {
    if ((records.Records ?? []).length > 0 && iterator) {
      for (const record of records.Records ?? []) {
        const json = JSON.parse(
          zlib.gunzipSync(Buffer.from(record.Data as unknown as string, 'base64')).toString('utf8'),
        );
        if (json.messageType === 'DATA_MESSAGE') {
          for (const logEvent of json.logEvents) {
            ({ shouldReadLogs, shouldCleanup, output } = FollowLogStreamService.handleIteration(
              logEvent.message,
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
    return await AwsClientFactory.getKinesis().send(new DescribeStreamCommand({ StreamName: kinesisStreamName }));
  }

  private static async getLogIterator(stream: any) {
    return (
      (
        await AwsClientFactory.getKinesis().send(
          new GetShardIteratorCommand({
            ShardIteratorType: 'TRIM_HORIZON',
            StreamName: stream.StreamDescription?.StreamName ?? '',
            ShardId: stream.StreamDescription?.Shards?.[0]?.ShardId || '',
          }),
        )
      ).ShardIterator || ''
    );
  }
}
export default AWSTaskRunner;
