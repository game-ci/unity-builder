import * as SDK from 'aws-sdk';
import { customAlphabet } from 'nanoid';
import RemoteBuilderSecret from './remote-builder-secret';
import RemoteBuilderEnvironmentVariable from './remote-builder-environment-variable';
import * as fs from 'fs';
import * as core from '@actions/core';
import * as zlib from 'zlib';
import RemoteBuilderTaskDef from './remote-builder-task-def';
import RemoteBuilderAlphabet from './remote-builder-alphabet';

class AWS {
  static async run(
    buildId: string,
    stackName: string,
    image: string,
    commands: string[],
    mountdir: string,
    workingdir: string,
    environment: RemoteBuilderEnvironmentVariable[],
    secrets: RemoteBuilderSecret[],
  ) {
    const ECS = new SDK.ECS();
    const CF = new SDK.CloudFormation();
    const entrypoint = ['/bin/sh'];

    const taskDef = await this.setupCloudFormations(
      CF,
      buildId,
      stackName,
      image,
      entrypoint,
      commands,
      mountdir,
      workingdir,
      secrets,
    );

    await this.runTask(taskDef, ECS, CF, environment, buildId);

    await this.cleanupResources(CF, taskDef);
  }

  static async setupCloudFormations(
    CF: SDK.CloudFormation,
    buildUid: string,
    stackName: string,
    image: string,
    entrypoint: string[],
    commands: string[],
    mountdir: string,
    workingdir: string,
    secrets: RemoteBuilderSecret[],
  ): Promise<RemoteBuilderTaskDef> {
    const logid = customAlphabet(RemoteBuilderAlphabet.alphabet, 9)();
    commands[1] += `
      echo "${logid}"
    `;
    const taskDefStackName = `${stackName}-${buildUid}`;
    let taskDefCloudFormation = this.readTaskCloudFormationTemplate();
    core.info(JSON.stringify(secrets, undefined, 4));
    for (const secret of secrets) {
      const insertionStringParameters = 'p1 - input';
      const insertionStringSecrets = 'p2 - secret';
      const insertionStringContainerSecrets = 'p3 - container def';
      const indexp1 =
        taskDefCloudFormation.search(insertionStringParameters) + insertionStringParameters.length + '\n'.length;
      const parameterTemplate = `
  ${secret.ParameterKey}:
    Type: String
    Default: ''
`;
      taskDefCloudFormation = [
        taskDefCloudFormation.slice(0, indexp1),
        parameterTemplate,
        taskDefCloudFormation.slice(indexp1),
      ].join('');
      const indexp2 =
        taskDefCloudFormation.search(insertionStringSecrets) + insertionStringSecrets.length + '\n'.length;
      const secretTemplate = `
  ${secret.ParameterKey.replace(/[^\dA-Za-z]/g, '')}Secret:
    Type: AWS::SecretsManager::Secret
    Properties: 
      Name: !Join [ "", [ '${secret.ParameterKey.replace(/[^\dA-Za-z]/g, '')}', !Ref BUILDID ] ]
      SecretString: !Ref ${secret.ParameterKey.replace(/[^\dA-Za-z]/g, '')}
`;
      taskDefCloudFormation = [
        taskDefCloudFormation.slice(0, indexp2),
        secretTemplate,
        taskDefCloudFormation.slice(indexp2),
      ].join('');
      const indexp3 =
        taskDefCloudFormation.search(insertionStringContainerSecrets) + insertionStringContainerSecrets.length;
      const containerDefinitionSecretTemplate = `
            - Name: '${
              secret.EnvironmentVariable.replace(/[^\dA-Za-z]/g, '')
                ? secret.EnvironmentVariable.replace(/[^\dA-Za-z]/g, '')
                : secret.ParameterKey.replace(/[^\dA-Za-z]/g, '')
            }'
              ValueFrom: !Ref ${secret.ParameterKey.replace(/[^\dA-Za-z]/g, '')}Secret`;
      taskDefCloudFormation = [
        taskDefCloudFormation.slice(0, indexp3),
        containerDefinitionSecretTemplate,
        taskDefCloudFormation.slice(indexp3),
      ].join('');
    }
    core.info(taskDefCloudFormation);
    const mappedSecrets = secrets.map((x) => {
      return { ParameterKey: x.ParameterKey.replace(/[^\dA-Za-z]/g, ''), ParameterValue: x.ParameterValue };
    });
    await CF.createStack({
      StackName: taskDefStackName,
      TemplateBody: taskDefCloudFormation,
      Parameters: [
        {
          ParameterKey: 'ImageUrl',
          ParameterValue: image,
        },
        {
          ParameterKey: 'ServiceName',
          ParameterValue: taskDefStackName,
        },
        {
          ParameterKey: 'Command',
          ParameterValue: commands.join(','),
        },
        {
          ParameterKey: 'EntryPoint',
          ParameterValue: entrypoint.join(','),
        },
        {
          ParameterKey: 'WorkingDirectory',
          ParameterValue: workingdir,
        },
        {
          ParameterKey: 'EFSMountDirectory',
          ParameterValue: mountdir,
        },
        {
          ParameterKey: 'BUILDID',
          ParameterValue: buildUid,
        },
        ...mappedSecrets,
      ],
    }).promise();
    core.info('Creating worker cluster...');

    const cleanupTaskDefStackName = `${taskDefStackName}-cleanup`;
    const cleanupCloudFormation = fs.readFileSync(`${__dirname}/cloud-formations/cloudformation-stack-ttl.yml`, 'utf8');
    await CF.createStack({
      StackName: cleanupTaskDefStackName,
      TemplateBody: cleanupCloudFormation,
      Capabilities: ['CAPABILITY_IAM'],
      Parameters: [
        {
          ParameterKey: 'StackName',
          ParameterValue: taskDefStackName,
        },
        {
          ParameterKey: 'DeleteStackName',
          ParameterValue: cleanupTaskDefStackName,
        },
        {
          ParameterKey: 'TTL',
          ParameterValue: '100',
        },
        {
          ParameterKey: 'BUILDID',
          ParameterValue: buildUid,
        },
      ],
    }).promise();
    core.info('Creating cleanup cluster...');

    try {
      await CF.waitFor('stackCreateComplete', { StackName: taskDefStackName }).promise();
    } catch (error) {
      core.error(error);

      const events = (await CF.describeStackEvents({ StackName: taskDefStackName }).promise()).StackEvents;
      const resources = (await CF.describeStackResources({ StackName: taskDefStackName }).promise()).StackResources;
      core.info(JSON.stringify(events, undefined, 4));
      core.info(JSON.stringify(resources, undefined, 4));

      throw error;
    }

    const taskDefResources = (
      await CF.describeStackResources({
        StackName: taskDefStackName,
      }).promise()
    ).StackResources;

    const baseResources = (await CF.describeStackResources({ StackName: stackName }).promise()).StackResources;

    // in the future we should offer a parameter to choose if you want the guarnteed shutdown.
    core.info('Worker cluster created successfully (skipping wait for cleanup cluster to be ready)');

    return {
      taskDefStackName,
      taskDefCloudFormation,
      taskDefStackNameTTL: cleanupTaskDefStackName,
      ttlCloudFormation: cleanupCloudFormation,
      taskDefResources,
      baseResources,
      logid,
    };
  }

  static readTaskCloudFormationTemplate(): string {
    return fs.readFileSync(`${__dirname}/cloud-formations/task-def-formation.yml`, 'utf8');
  }

  static async runTask(
    taskDef: RemoteBuilderTaskDef,
    ECS: AWS.ECS,
    CF: AWS.CloudFormation,
    environment: RemoteBuilderEnvironmentVariable[],
    buildUid: string,
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
            environment: [...environment, { name: 'BUILDID', value: buildUid }],
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

    core.info('Task is starting on worker cluster');
    const taskArn = task.tasks?.[0].taskArn || '';

    try {
      await ECS.waitFor('tasksRunning', { tasks: [taskArn], cluster }).promise();
    } catch (error) {
      await new Promise((resolve) => setTimeout(resolve, 3000));
      const describeTasks = await ECS.describeTasks({
        tasks: [taskArn],
        cluster,
      }).promise();
      core.info(`Task has ended ${describeTasks.tasks?.[0].containers?.[0].lastStatus}`);
      core.setFailed(error);
      core.error(error);
    }
    core.info(`Task is running on worker cluster`);
    await this.streamLogsUntilTaskStops(ECS, CF, taskDef, cluster, taskArn, streamName);
    await ECS.waitFor('tasksStopped', { cluster, tasks: [taskArn] }).promise();
    const exitCode = (
      await ECS.describeTasks({
        tasks: [taskArn],
        cluster,
      }).promise()
    ).tasks?.[0].containers?.[0].exitCode;
    if (exitCode !== 0) {
      try {
        await this.cleanupResources(CF, taskDef);
      } catch (error) {
        core.warning(`failed to cleanup ${error}`);
      }
      core.error(`job failed with exit code ${exitCode}`);
      throw new Error(`job failed with exit code ${exitCode}`);
    } else {
      core.info(`Task has finished successfully`);
    }
  }

  static async streamLogsUntilTaskStops(
    ECS: AWS.ECS,
    CF: AWS.CloudFormation,
    taskDef: RemoteBuilderTaskDef,
    clusterName: string,
    taskArn: string,
    kinesisStreamName: string,
  ) {
    // watching logs
    const kinesis = new SDK.Kinesis();

    const getTaskData = async () => {
      const tasks = await ECS.describeTasks({
        cluster: clusterName,
        tasks: [taskArn],
      }).promise();
      return tasks.tasks?.[0];
    };

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

    await CF.waitFor('stackCreateComplete', { StackName: taskDef.taskDefStackNameTTL }).promise();

    core.info(`Task status is ${(await getTaskData())?.lastStatus}`);

    const logBaseUrl = `https://${SDK.config.region}.console.aws.amazon.com/cloudwatch/home?region=${SDK.config.region}#logsV2:log-groups/log-group/${taskDef.taskDefStackName}`;
    core.info(`You can also see the logs at AWS Cloud Watch: ${logBaseUrl}`);

    let readingLogs = true;
    let timestamp: number = 0;
    while (readingLogs) {
      await new Promise((resolve) => setTimeout(resolve, 1500));
      const taskData = await getTaskData();
      if (taskData?.lastStatus !== 'RUNNING') {
        if (timestamp === 0) {
          core.info('Task stopped, streaming end of logs');
          timestamp = Date.now();
        }
        if (timestamp !== 0 && Date.now() - timestamp < 30000) {
          core.info('Task status is not RUNNING for 30 seconds, last query for logs');
          readingLogs = false;
        }
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
                core.info('End of task logs');
                readingLogs = false;
              } else {
                core.info(json.logEvents[logEventsIndex].message);
              }
            }
          }
        }
      }
    }
  }

  static async cleanupResources(CF: AWS.CloudFormation, taskDef: RemoteBuilderTaskDef) {
    await CF.deleteStack({
      StackName: taskDef.taskDefStackName,
    }).promise();

    await CF.deleteStack({
      StackName: taskDef.taskDefStackNameTTL,
    }).promise();

    await CF.waitFor('stackDeleteComplete', {
      StackName: taskDef.taskDefStackName,
    }).promise();

    // Currently too slow and causes too much waiting
    await CF.waitFor('stackDeleteComplete', {
      StackName: taskDef.taskDefStackNameTTL,
    }).promise();

    core.info('Cleanup complete');
  }
}
export default AWS;
