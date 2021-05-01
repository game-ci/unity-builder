import * as SDK from 'aws-sdk';
import { customAlphabet } from 'nanoid';
import * as fs from 'fs';
import * as core from '@actions/core';
import * as zlib from 'zlib';
const alphabet = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz';
const repositoryDirectoryName = 'repo';
const efsDirectoryName = 'data';
const cacheDirectoryName = 'cache';

class AWS {
  static async runBuildJob(buildParameters, baseImage) {
    try {
      const nanoid = customAlphabet(alphabet, 4);
      const buildUid = `${process.env.GITHUB_RUN_NUMBER}-${buildParameters.platform
        .replace('Standalone', '')
        .replace('standalone', '')}-${nanoid()}`;
      const branchName = process.env.GITHUB_REF?.split('/').reverse()[0];

      core.info('Starting part 1/4 (clone from github and restore cache)');
      await this.run(
        buildUid,
        buildParameters.awsStackName,
        'alpine/git',
        ['/bin/sh'],
        [
          '-c',
          `apk update;
          apk add unzip;
          apk add git-lfs;
          apk add jq;
          # Get source repo for project to be built and game-ci repo for utilties
          git clone https://${buildParameters.githubToken}@github.com/${process.env.GITHUB_REPOSITORY}.git ${buildUid}/${repositoryDirectoryName} -q
          git clone https://${buildParameters.githubToken}@github.com/game-ci/unity-builder.git ${buildUid}/builder -q
          cd /${efsDirectoryName}/${buildUid}/${repositoryDirectoryName}/
          git checkout $GITHUB_SHA
          cd /${efsDirectoryName}/
          # Look for usable cache
          if [ ! -d ${cacheDirectoryName} ]; then
            mkdir ${cacheDirectoryName}
          fi
          cd ${cacheDirectoryName}
          if [ ! -d "${branchName}" ]; then
            mkdir "${branchName}"
          fi
          cd "${branchName}"
          echo " "
          echo "Cached Libraries for ${branchName} from previous builds:"
          ls
          echo " "
          libDir="/${efsDirectoryName}/${buildUid}/${repositoryDirectoryName}/${buildParameters.projectPath}/Library"
          if [ -d "$libDir" ]; then
            rm -r "$libDir"
            echo "Setup .gitignore to ignore Library folder and remove it from builds"
          fi
          echo 'Checking cache'
          # Restore cache
          latest=$(ls -t | head -1)
          if [ ! -z "$latest" ]; then
            echo "Library cache exists from build $latest from ${branchName}"
            echo 'Creating empty Library folder for cache'
            mkdir "$libDir"
            unzip -q $latest -d '/${efsDirectoryName}/${buildUid}/${repositoryDirectoryName}/${buildParameters.projectPath}/Library/.'
          else
            echo 'Cache does not exist'
          fi
          # Print out important directories
          echo ' '
          echo 'Repo:'
          ls /${efsDirectoryName}/${buildUid}/${repositoryDirectoryName}/
          echo ' '
          echo 'Project:'
          ls /${efsDirectoryName}/${buildUid}/${repositoryDirectoryName}/${buildParameters.projectPath}
          echo ' '
          echo 'Library:'
          ls /${efsDirectoryName}/${buildUid}/${repositoryDirectoryName}/${buildParameters.projectPath}/Library/
          echo ' '
      `,
        ],
        `/${efsDirectoryName}`,
        `/${efsDirectoryName}/`,
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

      core.info('Starting part 2/4 (build unity project)');
      await this.run(
        buildUid,
        buildParameters.awsStackName,
        baseImage.toString(),
        ['/bin/sh'],
        [
          '-c',
          `
            cp -r /${efsDirectoryName}/${buildUid}/builder/dist/default-build-script/ /UnityBuilderAction;
            cp -r /${efsDirectoryName}/${buildUid}/builder/dist/entrypoint.sh /entrypoint.sh;
            cp -r /${efsDirectoryName}/${buildUid}/builder/dist/steps/ /steps;
            chmod -R +x /entrypoint.sh;
            chmod -R +x /steps;
            /entrypoint.sh;
          `,
        ],
        `/${efsDirectoryName}`,
        `/${efsDirectoryName}/${buildUid}/${repositoryDirectoryName}/`,
        [
          {
            name: 'ContainerMemory',
            value: buildParameters.remoteBuildMemory,
          },
          {
            name: 'ContainerCpu',
            value: buildParameters.remoteBuildCpu,
          },
          {
            name: 'GITHUB_WORKSPACE',
            value: `/${efsDirectoryName}/${buildUid}/${repositoryDirectoryName}/`,
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
            name: 'CHOWN_FILES_TO',
            value: buildParameters.chownFilesTo,
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
      core.info('Starting part 3/4 (zip unity build and Library for caching)');
      // Cleanup
      await this.run(
        buildUid,
        buildParameters.awsStackName,
        'alpine',
        ['/bin/sh'],
        [
          '-c',
          `
            apk update
            apk add zip
            cd Library
            zip -q -r lib-${buildUid}.zip .*
            mv lib-${buildUid}.zip /${efsDirectoryName}/${cacheDirectoryName}/${branchName}/lib-${buildUid}.zip
            cd ../../
            zip -q -r build-${buildUid}.zip ${buildParameters.buildPath}/*
            mv build-${buildUid}.zip /${efsDirectoryName}/${buildUid}/build-${buildUid}.zip
          `,
        ],
        `/${efsDirectoryName}`,
        `/${efsDirectoryName}/${buildUid}/${repositoryDirectoryName}/${buildParameters.projectPath}`,
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

      core.info('Starting part 4/4 (upload build to s3)');
      await this.run(
        buildUid,
        buildParameters.awsStackName,
        'amazon/aws-cli',
        ['/bin/sh'],
        [
          '-c',
          `
            aws s3 cp ${buildUid}/build-${buildUid}.zip s3://game-ci-storage/
            # no need to upload Library cache for now
            # aws s3 cp /${efsDirectoryName}/${cacheDirectoryName}/${branchName}/lib-${buildUid}.zip s3://game-ci-storage/
            rm -r ${buildUid}
          `,
        ],
        `/${efsDirectoryName}`,
        `/${efsDirectoryName}/`,
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
    const logid = customAlphabet(alphabet, 9)();
    commands[1] += `
      echo "${logid}"
    `;
    const taskDefStackName = `${stackName}-${buildUid}`;
    const taskDefCloudFormation = fs.readFileSync(`${__dirname}/cloud-formations/task-def-formation.yml`, 'utf8');
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
    }
    const taskDefResources = await CF.describeStackResources({
      StackName: taskDefStackName,
    }).promise();

    const baseResources = await CF.describeStackResources({ StackName: stackName }).promise();

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

  static async runTask(taskDef, ECS, CF, environment, buildUid) {
    const cluster =
      taskDef.baseResources.StackResources?.find((x) => x.LogicalResourceId === 'ECSCluster')?.PhysicalResourceId || '';
    const taskDefinition =
      taskDef.taskDefResources.StackResources?.find((x) => x.LogicalResourceId === 'TaskDefinition')
        ?.PhysicalResourceId || '';
    const SubnetOne =
      taskDef.baseResources.StackResources?.find((x) => x.LogicalResourceId === 'PublicSubnetOne')
        ?.PhysicalResourceId || '';
    const SubnetTwo =
      taskDef.baseResources.StackResources?.find((x) => x.LogicalResourceId === 'PublicSubnetTwo')
        ?.PhysicalResourceId || '';
    const ContainerSecurityGroup =
      taskDef.baseResources.StackResources?.find((x) => x.LogicalResourceId === 'ContainerSecurityGroup')
        ?.PhysicalResourceId || '';
    const streamName =
      taskDef.taskDefResources.StackResources?.find((x) => x.LogicalResourceId === 'KinesisStream')
        ?.PhysicalResourceId || '';

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

  static async streamLogsUntilTaskStops(ECS: AWS.ECS, CF, taskDef, clusterName, taskArn, kinesisStreamName) {
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
