/* eslint-disable no-plusplus */
/* eslint-disable no-await-in-loop */
import * as SDK from 'aws-sdk';
import { nanoid } from 'nanoid';
import * as fs from 'fs';
import * as core from '@actions/core';
import * as zlib from 'zlib';
import BuildParameters from './build-parameters';

class AWS {
  static async runBuildJob(buildParameters, baseImage) {
    try{

    let buildUid = nanoid();
    await this.run(buildUid,
      buildParameters.awsStackName,
      'alpine/git',
      ['/bin/sh'],
      [
        '-c', 
        `apk update;
        apk add git-lfs;
        apk add jq;
        ls;
        git clone https://$GITHUB_TOKEN@github.com/${process.env.GITHUB_REPOSITORY}.git ${buildUid}/repo;
        git clone https://$GITHUB_TOKEN@github.com/webbertakken/unity-builder.git ${buildUid}/builder;
        cd ${buildUid}/repo;
        git checkout $GITHUB_SHA;
      `],
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
    await this.run(buildUid,
      buildParameters.awsStackName,
      baseImage.toString(),
      ['/bin/sh'],
      ['-c', `
      cp -r /data/${buildUid}/builder/action/default-build-script /UnityBuilderAction;
      cp -r /data/${buildUid}/builder/action/entrypoint.sh /entrypoint.sh;
      cp -r /data/${buildUid}/builder/action/steps /steps;
      ls;
      chmod -R +x /entrypoint.sh;
      chmod -R +x /steps;
      /entrypoint.sh;
      ls
      `],
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
          ParameterValue: process.env.UNITY_LICENSE?process.env.UNITY_LICENSE:'0'
        },
        {
          ParameterKey: 'UnityEmail',
          ParameterValue: process.env.UNITY_EMAIL?process.env.UNITY_EMAIL:'0'
        },
        {
          ParameterKey: 'UnityPassword',
          ParameterValue: process.env.UNITY_PASSWORD?process.env.UNITY_PASSWORD:'0'
        },
        {
          ParameterKey: 'UnitySerial',
          ParameterValue: process.env.UNITY_SERIAL?process.env.UNITY_SERIAL:'0'
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
    // Cleanup
    await this.run(buildUid,
      buildParameters.awsStackName,
      'alpine',
      ['/bin/sh'],
      [
        '-c', 
        `
        apk update;
        apk add zip
        zip -r ./${buildUid}/output.zip ./${buildUid}/repo/build
        ls
      `],
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
    await this.run(buildUid,
      buildParameters.awsStackName,
      'amazon/aws-cli',
      ['/bin/sh'],
      [
        '-c', 
        `
        aws s3 cp ./${buildUid}/output.zip s3://game-ci-storage/${buildUid}
        rm -r ${buildUid}
        ls
      `],
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
    }
    catch(error){
      core.setFailed(error);
      core.error(error);
    }
  }

  static async run(buildUid:string, stackName:string, image:string, entrypoint:string[], commands, mountdir, workingdir, environment, secrets) {
    const ECS = new SDK.ECS();
    const CF = new SDK.CloudFormation();

    const taskDefStackName = `${stackName}-taskDef-${image}-${buildUid}`
      .toString()
      .replace(/[^\da-z]/gi, '');
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
        }
      ].concat(secrets),
    }).promise();
    core.info("Creating build cluster...");

    const taskDefStackNameTTL = taskDefStackName+"-ttl";
    const ttlCloudFormation = fs.readFileSync(`${__dirname}/cloudformation-stack-ttl.yml`, 'utf8');
    await CF.createStack({
      StackName: taskDefStackNameTTL,
      TemplateBody: ttlCloudFormation,
      Capabilities: [ "CAPABILITY_IAM" ],
      Parameters: [
        {
          ParameterKey: 'StackName',
          ParameterValue: taskDefStackName,
        },
        {
          ParameterKey: 'TTL',
          ParameterValue: "100",
        },
        {
          ParameterKey: 'BUILDID',
          ParameterValue: buildUid,
        }
      ],
    }).promise();
    core.info("Creating cleanup cluster...");

    try{
      await CF.waitFor('stackCreateComplete', { StackName: taskDefStackName }).promise();
    }catch(error){
      core.error(error);
    }
    core.info("Cloud formation stack created");

    const taskDefResources = await CF.describeStackResources({
      StackName: taskDefStackName,
    }).promise();


    const baseResources = await CF.describeStackResources({ StackName: stackName }).promise();

    const clusterName = baseResources.StackResources?.find(
      (x) => x.LogicalResourceId === 'ECSCluster',
    )?.PhysicalResourceId || "";
    const task = await ECS.runTask({
      cluster: clusterName,
      taskDefinition: taskDefResources.StackResources?.find(
        (x) => x.LogicalResourceId === 'TaskDefinition',
      )?.PhysicalResourceId || "",
      platformVersion: '1.4.0',
      overrides: {
        containerOverrides: [
          {
            name: taskDefStackName,
            environment: environment.concat([
              {name:'BUILDID', value: buildUid}
            ]),
          },
        ],
      },
      launchType: 'FARGATE',
      networkConfiguration: {
        awsvpcConfiguration: {
          subnets: [
            baseResources.StackResources?.find((x) => x.LogicalResourceId === 'PublicSubnetOne')?.PhysicalResourceId || "",
            baseResources.StackResources?.find((x) => x.LogicalResourceId === 'PublicSubnetTwo')?.PhysicalResourceId || "",
          ],
          assignPublicIp: 'ENABLED',
          securityGroups: [
            baseResources.StackResources?.find((x) => x.LogicalResourceId === 'ContainerSecurityGroup')?.PhysicalResourceId || "",
          ],
        },
      },
    }, undefined).promise();

    core.info('Build job is starting');

    try {
      await ECS.waitFor('tasksRunning', {tasks: [task.tasks?.[0].taskArn||""],
        cluster: clusterName,
      }).promise();
    } catch (error) {
      await new Promise((resolve) => setTimeout(resolve, 3000));
      let describeTasks = await ECS.describeTasks({
        tasks: [task.tasks?.[0].taskArn||""],
        cluster: clusterName,
      }).promise();
      core.info(
      `Build job has ended ${describeTasks.tasks?.[0].containers?.[0].lastStatus}`
      );
      core.setFailed(error);
      core.error(error);
    }
    

    core.info(`Build job is running`);

    // watching logs
    const kinesis = new SDK.Kinesis();

    const getTaskStatus = async () => {
      const tasks = await ECS.describeTasks({
        cluster: clusterName,
        tasks: [task.tasks?.[0].taskArn||""],
      }).promise();
      return tasks.tasks?.[0].lastStatus;
    };

    const stream = await kinesis.describeStream({
        StreamName: taskDefResources.StackResources?.find(
          (x) => x.LogicalResourceId === 'KinesisStream',
        )?.PhysicalResourceId||"",
      }, undefined).promise();

    let iterator = (
      await kinesis
        .getShardIterator({
          ShardIteratorType: 'TRIM_HORIZON',
          StreamName: stream.StreamDescription.StreamName,
          ShardId: stream.StreamDescription.Shards[0].ShardId,
        })
        .promise()
    ).ShardIterator||"";

    await CF.waitFor('stackCreateComplete', { StackName: taskDefStackNameTTL }).promise();
    
    core.info(`Task status is ${await getTaskStatus()}`);

    const logBaseUrl = `https://console.aws.amazon.com/cloudwatch/home?region=${SDK.config.region}#logsV2:log-groups/${taskDefStackName}`;
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
      iterator = records.NextShardIterator||"";
      if (records.Records.length > 0) {
        for (let index = 0; index < records.Records.length; index++) {
          const json = JSON.parse(
            zlib.gunzipSync(Buffer.from(records.Records[index].Data.toString(), 'base64')).toString('utf8'),
          );
          if (json.messageType === 'DATA_MESSAGE') {
            for (let logEventsIndex = 0; logEventsIndex < json.logEvents.length; logEventsIndex++) {
              core.info(json.logEvents[logEventsIndex].message);
            }
          }
        }
      }
    }

    await ECS.waitFor('tasksStopped', { cluster: clusterName, tasks: [task.tasks?.[0].taskArn||""]}).promise();

    const exitCode = (await ECS.describeTasks({
        tasks: [task.tasks?.[0].taskArn||""],
        cluster: clusterName,
      }).promise()
    ).tasks?.[0].containers?.[0].exitCode;

    if(exitCode!=0){
      core.error(`job finished with exit code ${exitCode}`)
    }
    else{
      core.info(`Build job has finished with exit code 0`);
    }

    await CF.deleteStack({
      StackName: taskDefStackName,
    }).promise();

    await CF.deleteStack({
      StackName: taskDefStackNameTTL,
    }).promise();

    await CF.waitFor('stackDeleteComplete', {
      StackName: taskDefStackName
    }).promise();

    await CF.waitFor('stackDeleteComplete', {
      StackName: taskDefStackNameTTL
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