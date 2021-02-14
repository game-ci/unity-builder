/* eslint-disable no-plusplus */
/* eslint-disable no-await-in-loop */
import * as SDK from 'aws-sdk';
import { nanoid } from 'nanoid';

const fs = require('fs');
const core = require('@actions/core');
const zlib = require('zlib');

class AWS {
  static async runBuildJob(buildParameters, baseImage) {
    try{

    let buildId = nanoid();
    await this.run(
      buildParameters.awsStackName,
      'alpine/git',
      ['/bin/sh'],
      [
        '-c', 
        `apk update;
        apk add git-lfs;
        apk add jq;
        ls;
        git clone https://github.com/${process.env.GITHUB_REPOSITORY}.git $BUILD_ID/repo;
        git clone https://github.com/webbertakken/unity-builder.git $BUILD_ID/builder;
        cd $BUILD_ID/repo;
        git checkout $GITHUB_SHA;
      `],
      '/data',
      '/data/',
      [
        {
          name: 'GITHUB_SHA',
          value: process.env.GITHUB_SHA,
        },
        {
          name: 'BUILD_ID',
          value: buildId,
        },
      ],
      [],
    );
    await this.run(
      buildParameters.awsStackName,
      baseImage.toString(),
      ['/bin/sh'],
      ['-c', `
      if [$GITHUB_TOKEN -eq '0']; then unset GITHUB_TOKEN; fi;
      if [$UNITY_LICENSE -eq '0']; then unset UNITY_LICENSE; fi;
      if [$ANDROID_KEYSTORE_BASE64 -eq '0']; then unset ANDROID_KEYSTORE_BASE64; fi;
      if [$ANDROID_KEYSTORE_PASS -eq '0']; then unset ANDROID_KEYSTORE_PASS; fi;
      if [$ANDROID_KEYALIAS_PASS -eq '0']; then unset ANDROID_KEYALIAS_PASS; fi;
      cp -r /data/$BUILD_ID/builder/action/default-build-script /UnityBuilderAction;
      cp -r /data/$BUILD_ID/builder/action/entrypoint.sh /entrypoint.sh;
      cp -r /data/$BUILD_ID/builder/action/steps /steps;
      ls;
      chmod -R +x /entrypoint.sh;
      chmod -R +x /steps;
      /entrypoint.sh;
      `],
      '/data',
      `/data/${buildId}/repo/`,
      [
        {
          name: 'BUILD_ID',
          value: buildId,
        },
        {
          name: 'GITHUB_WORKSPACE',
          value: `/data/${buildId}/repo/`,
        },
        {
          name: 'PROJECT_PATH',
          value: buildParameters.projectPath,
        },
        {
          name: 'BUILD_PATH',
          value: buildParameters.buildPath,
        },
        {
          name: 'BUILD_FILE',
          value: buildParameters.buildFile,
        },
        {
          name: 'BUILD_NAME',
          value: buildParameters.buildName,
        },
        {
          name: 'BUILD_METHOD',
          value: buildParameters.buildMethod,
        },
        {
          name: 'CUSTOM_PARAMETERS',
          value: buildParameters.customParameters,
        },
        {
          name: 'BUILD_TARGET',
          value: buildParameters.platform,
        },
        {
          name: 'ANDROID_VERSION_CODE',
          value: buildParameters.androidVersionCode.toString(),
        },
        {
          name: 'ANDROID_KEYSTORE_NAME',
          value: buildParameters.androidKeystoreName,
        },
        {
          name: 'ANDROID_KEYALIAS_NAME',
          value: buildParameters.androidKeyaliasName,
        },
      ],
      [
        {
          ParameterKey: 'GithubToken',
          ParameterValue: buildParameters.githubToken,
        },
        {
          ParameterKey: 'UnityLicense',
          ParameterValue: process.env.UNITY_LICENSE
        },
        {
          ParameterKey: 'AndroidKeystoreBase64',
          ParameterValue: buildParameters.androidKeystoreBase64?buildParameters.androidKeystoreBase64:'0'
        },
        {
          ParameterKey: 'AndroidKeystorePass',
          ParameterValue: buildParameters.androidKeystorePass?buildParameters.androidKeystorePass:'0'
        },
        {
          ParameterKey: 'AndroidKeyAliasPass',
          ParameterValue: buildParameters.androidKeyaliasPass?buildParameters.androidKeyaliasPass:'0'
        },
      ]
    );
    }
    catch(error){
      core.error(error);
    }
  }

  static async run(stackName, image, entrypoint, commands, mountdir, workingdir, environment, secrets) {
    const ECS = new SDK.ECS();
    const CF = new SDK.CloudFormation();
    const jobId = nanoid();

    const taskDefStackName = `${stackName}-taskDef-${image}-${jobId}`
      .toString()
      .replace(/[^\da-z]/gi, '');
    core.info('Creating build job resources');
    const taskDefCloudFormation = fs.readFileSync(`${__dirname}/task-def-formation.yml`, 'utf8');
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
          ParameterValue: jobId,
        }
      ].concat(secrets),
    }).promise();
    await CF.waitFor('stackCreateComplete', { StackName: taskDefStackName }).promise();

    const taskDefResources = await CF.describeStackResources({
      StackName: taskDefStackName,
    }).promise();

    const baseResources = await CF.describeStackResources({ StackName: stackName }).promise();

    const clusterName = baseResources.StackResources.find(
      (x) => x.LogicalResourceId === 'ECSCluster',
    ).PhysicalResourceId;
    const task = await ECS.runTask({
      cluster: clusterName,
      taskDefinition: taskDefResources.StackResources.find(
        (x) => x.LogicalResourceId === 'TaskDefinition',
      ).PhysicalResourceId,
      platformVersion: '1.4.0',
      overrides: {
        containerOverrides: [
          {
            name: taskDefStackName,
            environment,
          },
        ],
      },
      launchType: 'FARGATE',
      networkConfiguration: {
        awsvpcConfiguration: {
          subnets: [
            baseResources.StackResources.find((x) => x.LogicalResourceId === 'PublicSubnetOne')
              .PhysicalResourceId,
            baseResources.StackResources.find((x) => x.LogicalResourceId === 'PublicSubnetTwo')
              .PhysicalResourceId,
          ],
          assignPublicIp: 'ENABLED',
          securityGroups: [
            baseResources.StackResources.find(
              (x) => x.LogicalResourceId === 'ContainerSecurityGroup',
            ).PhysicalResourceId,
          ],
        },
      },
    }).promise();

    core.info('Build job is starting');

    try {
      await ECS.waitFor('tasksRunning', {
        cluster: clusterName,
        tasks: [task.tasks[0].taskArn],
      }).promise();
    } catch (error) {
      core.error(error);
    } finally{
      await new Promise((resolve) => setTimeout(resolve, 3000));
      core.info(
        `Build job has ended ${
          (
            await ECS.describeTasks({
              tasks: [task.tasks[0].taskArn],
              cluster: clusterName,
            }).promise()
          ).tasks[0].containers[0].lastStatus
        }`,
      );
  
    }

    core.info(`Build job is running`);

    // watching logs
    const kinesis = new SDK.Kinesis();

    const getTaskStatus = async () => {
      const tasks = await ECS.describeTasks({
        cluster: clusterName,
        tasks: [task.tasks[0].taskArn],
      }).promise();
      return tasks.tasks[0].lastStatus;
    };

    const stream = await kinesis
      .describeStream({
        StreamName: taskDefResources.StackResources.find(
          (x) => x.LogicalResourceId === 'KinesisStream',
        ).PhysicalResourceId,
      })
      .promise();

    let iterator = (
      await kinesis
        .getShardIterator({
          ShardIteratorType: 'TRIM_HORIZON',
          StreamName: stream.StreamDescription.StreamName,
          ShardId: stream.StreamDescription.Shards[0].ShardId,
        })
        .promise()
    ).ShardIterator;

    core.info(`Task status is ${await getTaskStatus()}`);
    let readingLogs = true;
    while (readingLogs) {
      await new Promise((resolve) => setTimeout(resolve, 3000));
      if ((await getTaskStatus()) !== 'RUNNING') {
        readingLogs = false;
        await new Promise((resolve) => setTimeout(resolve, 35000));
      }
      const records = await kinesis
        .getRecords({
          ShardIterator: iterator,
        })
        .promise();
      iterator = records.NextShardIterator;
      if (records.Records.length > 0) {
        for (let index = 0; index < records.Records.length; index++) {
          const json = JSON.parse(
            zlib.gunzipSync(Buffer.from(records.Records[index].Data, 'base64')).toString('utf8'),
          );
          if (json.messageType === 'DATA_MESSAGE') {
            for (let logEventsIndex = 0; logEventsIndex < json.logEvents.length; logEventsIndex++) {
              core.info(json.logEvents[logEventsIndex].message);
            }
          }
        }
      }
    }

    await ECS.waitFor('tasksStopped', {
      cluster: clusterName,
      tasks: [task.tasks[0].taskArn],
    }).promise();

    core.info(
      `Build job has ended ${
        (
          await ECS.describeTasks({
            tasks: [task.tasks[0].taskArn],
            cluster: clusterName,
          }).promise()
        ).tasks[0].containers[0].exitCode
      }`,
    );

    await CF.deleteStack({
      StackName: taskDefStackName,
    }).promise();

    core.info('Cleanup complete');
  }

  static onlog(batch) {
    batch.forEach((log) => {
      core.info(`log: ${log}`);
    });
  }
}
export default AWS;
