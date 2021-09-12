import * as AWS from 'aws-sdk';
import CloudRunnerEnvironmentVariable from './cloud-runner-environment-variable';
import * as core from '@actions/core';
import CloudRunnerTaskDef from './cloud-runner-task-def';
import * as zlib from 'zlib';

class AWSBuildRunner {
  static async runTask(
    taskDef: CloudRunnerTaskDef,
    ECS: AWS.ECS,
    CF: AWS.CloudFormation,
    environment: CloudRunnerEnvironmentVariable[],
    buildGuid: string,
    commands: string[],
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
            environment: [...environment, { name: 'BUILDID', value: buildGuid }],
            command: ['-c', ...commands],
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

    core.info('Cloud runner job is starting');
    const taskArn = task.tasks?.[0].taskArn || '';

    try {
      await ECS.waitFor('tasksRunning', { tasks: [taskArn], cluster }).promise();
    } catch (error_) {
      const error = error_ as Error;
      await new Promise((resolve) => setTimeout(resolve, 3000));
      core.info(
        `Cloud runner job has ended ${
          (await AWSBuildRunner.describeTasks(ECS, cluster, taskArn)).containers?.[0].lastStatus
        }`,
      );

      core.setFailed(error);
      core.error(error);
    }
    core.info(`Cloud runner job is running`);
    await this.streamLogsUntilTaskStops(ECS, CF, taskDef, cluster, taskArn, streamName);
    const exitCode = (await AWSBuildRunner.describeTasks(ECS, cluster, taskArn)).containers?.[0].exitCode;
    core.info(`Cloud runner job exit code ${exitCode}`);
    if (exitCode !== 0) {
      core.error(
        `job failed with exit code ${exitCode} ${JSON.stringify(
          await ECS.describeTasks({ tasks: [taskArn], cluster }).promise(),
          undefined,
          4,
        )}`,
      );
      throw new Error(`job failed with exit code ${exitCode}`);
    } else {
      core.info(`Cloud runner job has finished successfully`);
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
    taskDef: CloudRunnerTaskDef,
    clusterName: string,
    taskArn: string,
    kinesisStreamName: string,
  ) {
    // watching logs
    const kinesis = new AWS.Kinesis();

    const stream = await kinesis
      .describeStream({
        StreamName: kinesisStreamName,
      })
      .promise();

    let iterator =
      (
        await kinesis
          .getShardIterator({
            ShardIteratorType: 'TRIM_HORIZON',
            StreamName: stream.StreamDescription.StreamName,
            ShardId: stream.StreamDescription.Shards[0].ShardId,
          })
          .promise()
      ).ShardIterator || '';

    core.info(
      `Cloud runner job status is ${(await AWSBuildRunner.describeTasks(ECS, clusterName, taskArn))?.lastStatus}`,
    );

    const logBaseUrl = `https://${AWS.config.region}.console.aws.amazon.com/cloudwatch/home?region=${AWS.config.region}#logsV2:log-groups/log-group/${taskDef.taskDefStackName}`;
    core.info(`You can also see the logs at AWS Cloud Watch: ${logBaseUrl}`);
    let readingLogs = true;
    while (readingLogs) {
      await new Promise((resolve) => setTimeout(resolve, 1500));
      const taskData = await AWSBuildRunner.describeTasks(ECS, clusterName, taskArn);
      if (taskData?.lastStatus !== 'RUNNING') {
        core.info(`Status of job: ${taskData.lastStatus}`);
        readingLogs = false;
      }
      const records = await kinesis
        .getRecords({
          ShardIterator: iterator,
        })
        .promise();
      iterator = records.NextShardIterator || '';
      if (records.Records.length > 0 && iterator) {
        for (let index = 0; index < records.Records.length; index++) {
          const json = JSON.parse(
            zlib.gunzipSync(Buffer.from(records.Records[index].Data as string, 'base64')).toString('utf8'),
          );
          if (json.messageType === 'DATA_MESSAGE') {
            for (let logEventsIndex = 0; logEventsIndex < json.logEvents.length; logEventsIndex++) {
              if (json.logEvents[logEventsIndex].message.includes(taskDef.logid)) {
                core.info('End of cloud runner job logs');
                readingLogs = false;
              } else {
                const message = json.logEvents[logEventsIndex].message;
                if (message.includes('Rebuilding Library because the asset database could not be found!')) {
                  core.warning('LIBRARY NOT FOUND!');
                }
                core.info(message);
              }
            }
          }
        }
      }
    }
  }
}
export default AWSBuildRunner;
