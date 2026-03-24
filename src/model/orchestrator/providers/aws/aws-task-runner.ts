import { DescribeTasksCommand, RunTaskCommand, waitUntilTasksRunning } from '@aws-sdk/client-ecs';
import { DescribeStreamCommand, GetRecordsCommand, GetShardIteratorCommand } from '@aws-sdk/client-kinesis';
import OrchestratorEnvironmentVariable from '../../options/orchestrator-environment-variable';
import OrchestratorSecret from '../../options/orchestrator-secret';
import * as core from '@actions/core';
import OrchestratorAWSTaskDef from './orchestrator-aws-task-def';
import * as zlib from 'node:zlib';
import OrchestratorLogger from '../../services/core/orchestrator-logger';
import { Input } from '../../..';
import Orchestrator from '../../orchestrator';
import { CommandHookService } from '../../services/hooks/command-hook-service';
import { FollowLogStreamService } from '../../services/core/follow-log-stream-service';
import OrchestratorOptions from '../../options/orchestrator-options';
import GitHub from '../../../github';
import { AwsClientFactory } from './aws-client-factory';

class AWSTaskRunner {
  private static readonly encodedUnderscore = `$252F`;

  /**
   * Transform localhost endpoints to host.docker.internal for container environments.
   * When LocalStack is used, ECS tasks run in Docker containers that need to reach
   * LocalStack on the host machine via host.docker.internal.
   */
  private static transformEndpointsForContainer(
    environment: OrchestratorEnvironmentVariable[],
  ): OrchestratorEnvironmentVariable[] {
    const endpointEnvironmentNames = new Set([
      'AWS_S3_ENDPOINT',
      'AWS_ENDPOINT',
      'AWS_CLOUD_FORMATION_ENDPOINT',
      'AWS_ECS_ENDPOINT',
      'AWS_KINESIS_ENDPOINT',
      'AWS_CLOUD_WATCH_LOGS_ENDPOINT',
      'INPUT_AWSS3ENDPOINT',
      'INPUT_AWSENDPOINT',
    ]);

    return environment.map((x) => {
      let value = x.value;
      if (
        typeof value === 'string' &&
        endpointEnvironmentNames.has(x.name) &&
        (value.startsWith('http://localhost') || value.startsWith('http://127.0.0.1'))
      ) {
        // Replace localhost with host.docker.internal so ECS containers can access host services
        value = value
          .replace('http://localhost', 'http://host.docker.internal')
          .replace('http://127.0.0.1', 'http://host.docker.internal');
        OrchestratorLogger.log(`AWS TaskRunner: Replaced localhost with host.docker.internal for ${x.name}: ${value}`);
      }

      return { name: x.name, value };
    });
  }

  static async runTask(
    taskDef: OrchestratorAWSTaskDef,
    environment: OrchestratorEnvironmentVariable[],
    secrets: OrchestratorSecret[],
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

    // Transform localhost endpoints for container environment
    const transformedEnvironment = AWSTaskRunner.transformEndpointsForContainer(environment);

    // Merge secrets into environment as plain env vars, matching docker and k8s provider behavior.
    // This ensures UNITY_EMAIL, UNITY_PASSWORD, UNITY_SERIAL reach the container reliably
    // without depending on CloudFormation Secrets Manager resolution.
    const secretsAsEnvironment = secrets.map((s) => ({ name: s.EnvironmentVariable, value: s.ParameterValue }));
    const mergedEnvironment = [...transformedEnvironment, ...secretsAsEnvironment];

    const runParameters = {
      cluster,
      taskDefinition,
      platformVersion: '1.4.0',
      overrides: {
        containerOverrides: [
          {
            name: taskDef.taskDefStackName,
            environment: mergedEnvironment,
            command: ['-c', CommandHookService.ApplyHooksToCommands(commands, Orchestrator.buildParameters)],
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
      OrchestratorLogger.log(JSON.stringify(runParameters.overrides.containerOverrides, undefined, 4));
      throw new Error(`Container Overrides length must be at most 8192`);
    }

    const task = await AwsClientFactory.getECS().send(new RunTaskCommand(runParameters as any));
    const taskArn = task.tasks?.[0].taskArn || '';
    OrchestratorLogger.log('Orchestrator job is starting');
    await AWSTaskRunner.waitUntilTaskRunning(taskArn, cluster);
    OrchestratorLogger.log(
      `Orchestrator job status is running ${(await AWSTaskRunner.describeTasks(cluster, taskArn))?.lastStatus} Async:${
        OrchestratorOptions.asyncOrchestrator
      }`,
    );
    if (OrchestratorOptions.asyncOrchestrator) {
      const shouldCleanup: boolean = false;
      const output: string = '';
      OrchestratorLogger.log(`Watch Orchestrator To End: false`);

      return { output, shouldCleanup };
    }

    OrchestratorLogger.log(`Streaming...`);
    const { output, shouldCleanup } = await this.streamLogsUntilTaskStops(cluster, taskArn, streamName);
    let exitCode;
    let containerState;
    let taskData;
    while (exitCode === undefined) {
      await new Promise((resolve) => setTimeout(resolve, 10000));
      taskData = await AWSTaskRunner.describeTasks(cluster, taskArn);
      const containers = taskData?.containers as any[] | undefined;
      if (!containers || containers.length === 0) {
        continue;
      }
      containerState = containers[0];
      exitCode = containerState?.exitCode;
    }
    OrchestratorLogger.log(`Container State: ${JSON.stringify(containerState, undefined, 4)}`);
    if (exitCode === undefined) {
      OrchestratorLogger.logWarning(`Undefined exitcode for container`);
    }
    const wasSuccessful = exitCode === 0;
    if (wasSuccessful) {
      OrchestratorLogger.log(`Orchestrator job has finished successfully`);

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
          maxWaitTime: 300,
          minDelay: 5,
          maxDelay: 30,
        },
        { tasks: [taskArn], cluster },
      );
    } catch (error_) {
      const error = error_ as Error;
      await new Promise((resolve) => setTimeout(resolve, 3000));
      const taskAfterError = await AWSTaskRunner.describeTasks(cluster, taskArn);
      OrchestratorLogger.log(`Orchestrator job has ended ${taskAfterError?.containers?.[0]?.lastStatus}`);

      core.setFailed(error);
      core.error(error);
    }
  }

  static async describeTasks(clusterName: string, taskArn: string) {
    const maxAttempts = 10;
    let delayMs = 1000;
    const maxDelayMs = 60000;
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
        const jitterMs = Math.floor(Math.random() * Math.min(1000, delayMs));
        const sleepMs = delayMs + jitterMs;
        OrchestratorLogger.log(
          `AWS throttled DescribeTasks (attempt ${attempt}/${maxAttempts}), backing off ${sleepMs}ms (${delayMs} + jitter ${jitterMs})`,
        );
        await new Promise((r) => setTimeout(r, sleepMs));
        delayMs = Math.min(delayMs * 2, maxDelayMs);
      }
    }
  }

  static async streamLogsUntilTaskStops(clusterName: string, taskArn: string, kinesisStreamName: string) {
    await new Promise((resolve) => setTimeout(resolve, 3000));
    OrchestratorLogger.log(`Streaming...`);
    const stream = await AWSTaskRunner.getLogStream(kinesisStreamName);
    let iterator = await AWSTaskRunner.getLogIterator(stream);

    const logBaseUrl = `https://${Input.region}.console.aws.amazon.com/cloudwatch/home?region=${Input.region}#logsV2:log-groups/log-group/${Orchestrator.buildParameters.awsStackName}${AWSTaskRunner.encodedUnderscore}${Orchestrator.buildParameters.awsStackName}-${Orchestrator.buildParameters.buildGuid}`;
    OrchestratorLogger.log(`You view the log stream on AWS Cloud Watch: ${logBaseUrl}`);
    await GitHub.updateGitHubCheck(`You view the log stream on AWS Cloud Watch:  ${logBaseUrl}`, ``);
    let shouldReadLogs = true;
    let shouldCleanup = true;
    let timestamp: number = 0;
    let output = '';
    while (shouldReadLogs) {
      await new Promise((resolve) => setTimeout(resolve, 1500));
      const taskData = await AWSTaskRunner.describeTasks(clusterName, taskArn);
      ({ timestamp, shouldReadLogs } = AWSTaskRunner.checkStreamingShouldContinue(taskData, timestamp, shouldReadLogs));
      if (taskData?.lastStatus !== 'RUNNING') {
        await new Promise((resolve) => setTimeout(resolve, 3500));
      }
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
        const baseBackoffMs = 1000;
        const jitterMs = Math.floor(Math.random() * 1000);
        const sleepMs = baseBackoffMs + jitterMs;
        OrchestratorLogger.log(`AWS throttled GetRecords, backing off ${sleepMs}ms (1000 + jitter ${jitterMs})`);
        await new Promise((r) => setTimeout(r, sleepMs));

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
      OrchestratorLogger.log('## Orchestrator job unknwon');
    }
    if (taskData?.lastStatus !== 'RUNNING') {
      if (timestamp === 0) {
        OrchestratorLogger.log('## Orchestrator job stopped, streaming end of logs');
        timestamp = Date.now();
      }
      if (timestamp !== 0 && Date.now() - timestamp > 30000) {
        OrchestratorLogger.log('## Orchestrator status is not RUNNING for 30 seconds, last query for logs');
        shouldReadLogs = false;
      }
      OrchestratorLogger.log(`## Status of job: ${taskData.lastStatus}`);
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
