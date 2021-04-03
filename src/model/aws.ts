import * as SDK from 'aws-sdk';
import { nanoid } from 'nanoid';
import * as fs from 'fs';
import * as core from '@actions/core';
import * as zlib from 'zlib';

class AWS {
  static async runBuildJob(buildParameters, baseImage) {
    try {
      const buildUid = nanoid();
      
      core.info("starting part 1/4 (clone from github and restore cache)");
      await this.run(
        buildUid,
        buildParameters.awsStackName,
        'alpine/git',
        ['/bin/sh'],
        [
          '-c',
          `apk update;
        apk add zip;
        apk add git-lfs;
        apk add jq;
        ls;
        git clone https://${process.env.GITHUB_TOKEN}@github.com/${process.env.GITHUB_REPOSITORY}.git ${buildUid}/repo;
        git clone https://${process.env.GITHUB_TOKEN}@github.com/game-ci/unity-builder.git ${buildUid}/builder;
        
        if [ ! -d "cache" ]; then
          mkdir "cache"
        fi

        cd cache
        ls

        echo ''

        latest=$(ls -t | head -1)
        echo $latest
        if [ -f $latest ]; then
          echo "Cache exists"
          zip -r ./cache/lib.zip ./${buildUid}/repo/Library/.
        else
          echo "Cache does not exist"
        fi

        cd ..

        cd ${buildUid}/repo;
        git checkout $GITHUB_SHA;
      `,
        ],
        '/data',
        '/data/',
        [
          {
            name: 'GITHUB_SHA',
            value: process.env.GITHUB_SHA,
          },
        ],
        [
          {
            ParameterKey: 'GithubToken',
            ParameterValue: buildParameters.githubToken,
          },
        ],
      );
      
      core.info("starting part 2/4 (build)");
      await this.run(
        buildUid,
        buildParameters.awsStackName,
        baseImage.toString(),
        ['/bin/sh'],
        [
          '-c',
          `
      cp -R /data/${buildUid}/builder/dist/default-build-script/ /UnityBuilderAction;
      cp -R /data/${buildUid}/builder/dist/entrypoint.sh /entrypoint.sh;
      cp -R /data/${buildUid}/builder/dist/steps/ /steps;
      ls;
      chmod -R +x /entrypoint.sh;
      chmod -R +x /steps;
      /entrypoint.sh;
      ls
      `,
        ],
        '/data',
        `/data/${buildUid}/repo/`,
        [
          {
            name: 'GITHUB_WORKSPACE',
            value: `/data/${buildUid}/repo/`,
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
            ParameterValue: process.env.UNITY_LICENSE ? process.env.UNITY_LICENSE : '0',
          },
          {
            ParameterKey: 'UnityEmail',
            ParameterValue: process.env.UNITY_EMAIL ? process.env.UNITY_EMAIL : '0',
          },
          {
            ParameterKey: 'UnityPassword',
            ParameterValue: process.env.UNITY_PASSWORD ? process.env.UNITY_PASSWORD : '0',
          },
          {
            ParameterKey: 'UnitySerial',
            ParameterValue: process.env.UNITY_SERIAL ? process.env.UNITY_SERIAL : '0',
          },
          {
            ParameterKey: 'AndroidKeystoreBase64',
            ParameterValue: buildParameters.androidKeystoreBase64 ? buildParameters.androidKeystoreBase64 : '0',
          },
          {
            ParameterKey: 'AndroidKeystorePass',
            ParameterValue: buildParameters.androidKeystorePass ? buildParameters.androidKeystorePass : '0',
          },
          {
            ParameterKey: 'AndroidKeyAliasPass',
            ParameterValue: buildParameters.androidKeyaliasPass ? buildParameters.androidKeyaliasPass : '0',
          },
        ],
      );
      core.info("starting part 3/4 (zip and publish latest Library to cache)");
      // Cleanup
      await this.run(
        buildUid,
        buildParameters.awsStackName,
        'alpine',
        ['/bin/sh'],
        [
          '-c',
          `
        apk update;
        apk add zip
        zip -r ./${buildUid}/Library/. ./${process.env.GITHUB_REF}/lib.zip
        zip -r ./${buildUid}/output.zip ./${buildUid}/repo/build
        ls
      `,
        ],
        '/data',
        '/data/',
        [
          {
            name: 'GITHUB_SHA',
            value: process.env.GITHUB_SHA,
          },
        ],
        [
          {
            ParameterKey: 'GithubToken',
            ParameterValue: buildParameters.githubToken,
          },
        ],
      );

      core.info("starting part 4/4 (upload to s3)");
      await this.run(
        buildUid,
        buildParameters.awsStackName,
        'amazon/aws-cli',
        ['/bin/sh'],
        [
          '-c',
          `
        aws s3 cp ./${buildUid}/output.zip s3://game-ci-storage/${buildUid}.zip
        rm -r ${buildUid}
        ls
      `,
        ],
        '/data',
        '/data/',
        [
          {
            name: 'GITHUB_SHA',
            value: process.env.GITHUB_SHA,
          },
          {
            name: 'AWS_DEFAULT_REGION',
            value: process.env.AWS_DEFAULT_REGION,
          },
        ],
        [
          {
            ParameterKey: 'GithubToken',
            ParameterValue: buildParameters.githubToken,
          },
          {
            ParameterKey: 'AWSAccessKeyID',
            ParameterValue: process.env.AWS_ACCESS_KEY_ID,
          },
          {
            ParameterKey: 'AWSSecretAccessKey',
            ParameterValue: process.env.AWS_SECRET_ACCESS_KEY,
          },
        ],
      );
    } catch (error) {
      core.setFailed(error);
      core.error(error);
    }
  }

  static async run(
    buildUid: string,
    stackName: string,
    image: string,
    entrypoint: string[],
    commands,
    mountdir,
    workingdir,
    environment,
    secrets,
  ) {
    const ECS = new SDK.ECS();
    const CF = new SDK.CloudFormation();

    const taskDef = await this.setupCloudFormations(
      CF,
      buildUid,
      stackName,
      image,
      entrypoint,
      commands,
      mountdir,
      workingdir,
      secrets,
    );

    await this.runTask(taskDef, ECS, CF, environment, buildUid);

    await this.cleanupResources(CF, taskDef);
  }

  static async setupCloudFormations(
    CF,
    buildUid: string,
    stackName: string,
    image: string,
    entrypoint: string[],
    commands,
    mountdir,
    workingdir,
    secrets,
  ) {
    const taskDefStackName = `${stackName}-taskDef-${image}-${buildUid}`.toString().replace(/[^\da-z]/gi, '');
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
          ParameterValue: buildUid,
        },
        ...secrets,
      ],
    }).promise();
    core.info('Creating build cluster...');

    const taskDefStackNameTTL = `${taskDefStackName}-ttl`;
    const ttlCloudFormation = fs.readFileSync(`${__dirname}/cloudformation-stack-ttl.yml`, 'utf8');
    await CF.createStack({
      StackName: taskDefStackNameTTL,
      TemplateBody: ttlCloudFormation,
      Capabilities: ['CAPABILITY_IAM'],
      Parameters: [
        {
          ParameterKey: 'StackName',
          ParameterValue: taskDefStackName,
        },
        {
          ParameterKey: 'DeleteStackName',
          ParameterValue: taskDefStackNameTTL,
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
    }
    const taskDefResources = await CF.describeStackResources({
      StackName: taskDefStackName,
    }).promise();

    const baseResources = await CF.describeStackResources({ StackName: stackName }).promise();

    core.info('Build cluster created successfully (skipping waiting for cleanup cluster to start)');

    return {
      taskDefStackName,
      taskDefCloudFormation,
      taskDefStackNameTTL,
      ttlCloudFormation,
      taskDefResources,
      baseResources,
    };
  }

  static async runTask(taskDef, ECS, CF, environment, buildUid) {
    const clusterName =
      taskDef.baseResources.StackResources?.find((x) => x.LogicalResourceId === 'ECSCluster')?.PhysicalResourceId || '';
    const taskDefinition = taskDef.taskDefResources.StackResources?.find((x) => x.LogicalResourceId === 'TaskDefinition')
      ?.PhysicalResourceId || '';
    const SubnetOne = taskDef.baseResources.StackResources?.find((x) => x.LogicalResourceId === 'PublicSubnetOne')
      ?.PhysicalResourceId || '';
    const SubnetTwo = taskDef.baseResources.StackResources?.find((x) => x.LogicalResourceId === 'PublicSubnetTwo')
      ?.PhysicalResourceId || '';
    const ContainerSecurityGroup = taskDef.baseResources.StackResources?.find((x) => x.LogicalResourceId === 'ContainerSecurityGroup')
      ?.PhysicalResourceId || '';
    const streamName =
      taskDef.taskDefResources.StackResources?.find((x) => x.LogicalResourceId === 'KinesisStream')
        ?.PhysicalResourceId || '';
    
    const task = await ECS.runTask({
      cluster: clusterName,
      taskDefinition: taskDefinition,
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
          subnets: [ SubnetOne, SubnetTwo ],
          assignPublicIp: 'ENABLED',
          securityGroups: [ ContainerSecurityGroup ],
        },
      },
    }).promise();

    core.info('Build job is starting');
    const taskArn = task.tasks?.[0].taskArn || '';

    try {
      await ECS.waitFor('tasksRunning', { tasks: [taskArn], cluster: clusterName }).promise();
    } catch (error) {
      await new Promise((resolve) => setTimeout(resolve, 3000));
      const describeTasks = await ECS.describeTasks({
        tasks: [taskArn],
        cluster: clusterName,
      }).promise();
      core.info(`Build job has ended ${describeTasks.tasks?.[0].containers?.[0].lastStatus}`);
      core.setFailed(error);
      core.error(error);
    }
    core.info(`Build job is running`);
    await this.streamLogsUntilTaskStops(ECS, CF, taskDef, clusterName, taskArn, streamName);
    await ECS.waitFor('tasksStopped', { cluster: clusterName, tasks: [taskArn] }).promise();
    const exitCode = (
      await ECS.describeTasks({
        tasks: [taskArn],
        cluster: clusterName,
      }).promise()
    ).tasks?.[0].containers?.[0].exitCode;
    if (exitCode !== 0) {
      core.error(`job finished with exit code ${exitCode}`);
    } else {
      core.info(`Build job has finished with exit code 0`);
    }
  }

  static async streamLogsUntilTaskStops(ECS, CF, taskDef, clusterName, taskArn, kinesisStreamName) {
    // watching logs
    const kinesis = new SDK.Kinesis();

    const getTaskStatus = async () => {
      const tasks = await ECS.describeTasks({
        cluster: clusterName,
        tasks: [taskArn],
      }).promise();
      return tasks.tasks?.[0].lastStatus;
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

    core.info(`Task status is ${await getTaskStatus()}`);

    const logBaseUrl = `https://console.aws.amazon.com/cloudwatch/home?region=${SDK.config.region}#logsV2:log-groups/${taskDef.taskDefStackName}`;
    core.info(`You can also watch the logs at AWS Cloud Watch: ${logBaseUrl}`);

    let readingLogs = true;
    while (readingLogs) {
      await new Promise((resolve) => setTimeout(resolve, 1500));
      if ((await getTaskStatus()) !== 'RUNNING') {
        readingLogs = false;
        await new Promise((resolve) => setTimeout(resolve, 35000));
      }
      const records = await kinesis
        .getRecords({
          ShardIterator: iterator,
        })
        .promise();
      iterator = records.NextShardIterator || '';
      if (records.Records.length > 0) {
        for (let index = 0; index < records.Records.length; index++) {
          const json = JSON.parse(
            zlib.gunzipSync(Buffer.from(records.Records[index].Data as string, 'base64')).toString('utf8'),
          );
          if (json.messageType === 'DATA_MESSAGE') {
            for (let logEventsIndex = 0; logEventsIndex < json.logEvents.length; logEventsIndex++) {
              core.info(json.logEvents[logEventsIndex].message);
            }
          }
        }
      }
    }
  }

  static async cleanupResources(CF, taskDef) {
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

  static onlog(batch) {
    for (const log of batch) {
      core.info(`log: ${log}`);
    }
  }
}
export default AWS;
