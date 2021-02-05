/* eslint-disable no-plusplus */
/* eslint-disable no-await-in-loop */
import * as SDK from 'aws-sdk';

const fs = require('fs');
const core = require('@actions/core');
const hose = require('cloudwatch-logs-hose');

class AWS {
  static async runBuildJob(buildParameters, baseImage) {
    await this.run(
      buildParameters.awsStackName,
      'alpine/git',
      [
        '/bin/sh',
        '-c',
        `apk update;
        apk add git-lfs;
        ls ./;
        export GITHUB_TOKEN=$(cat /credentials/GITHUB_TOKEN);
        cd /data;
        git clone https://github.com/${process.env.GITHUB_REPOSITORY}.git repo;
        git clone https://github.com/webbertakken/unity-builder.git builder;
        cd repo;
        git checkout $GITHUB_SHA;
        ls`,
      ],
      [
        {
          name: 'GITHUB_SHA',
          value: process.env.GITHUB_SHA,
        },
      ],
    );
    await this.run(
      buildParameters.awsStackName,
      baseImage.toString(),
      ['bin/bash', '-c', 'echo "test"'],
      [
        {
          name: '',
          value: '',
        },
      ],
    );
  }

  static async run(stackName, image, commands, environment) {
    const ECS = new SDK.ECS();
    const CF = new SDK.CloudFormation();

    const alphanumericImageName = image.toString().replace(/[^\da-z]/gi, '');
    const taskDefStackName = `${stackName}-taskDef-${alphanumericImageName}`;
    const stackExists =
      (await CF.listStacks().promise()).StackSummaries.find(
        (x) => x.StackName === taskDefStackName,
      ) !== undefined;

    if (!stackExists) {
      core.info("Task Definition doesn't exist, creating a task definition stack");
      const taskDefCloudFormation = fs.readFileSync(`${__dirname}/task-def-formation.yml`, 'utf8');
      await CF.createStack({
        StackName: taskDefStackName,
        TemplateBody: taskDefCloudFormation,
        Parameters: [
          {
            ParameterKey: 'ImageUrl',
            ParameterValue: image,
          },
        ],
      }).promise();
      await CF.waitFor('stackCreateComplete', { StackName: taskDefStackName }).promise();
    } else {
      core.info('Task definition stack exists already');
    }

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
      launchType: 'FARGATE',
      overrides: {
        containerOverrides: [
          {
            name: 'example',
            command: commands,
            environment,
          },
        ],
      },
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

    await ECS.waitFor('tasksRunning', {
      cluster: clusterName,
      tasks: [task.tasks[0].taskArn],
    }).promise();

    core.info(`Build job is running, `);

    const stackInstance = await CF.describeStackInstance({ StackSetName: stackName }).promise();

    // watching logs
    const source = new hose.Source({
      LogGroup: baseResources.StackResources.find((x) => x.LogicalResourceId === 'LogGroup'),
      aws: { region: stackInstance.StackInstance.Region },
    });

    source.on('logs', AWS.onlog);

    source.on('error', (error) => {
      core.info('Error: ', error);
    });

    source.open();

    await ECS.waitFor('tasksStopped', {
      cluster: clusterName,
      tasks: [task.tasks[0].taskArn],
    }).promise();

    core.info('Build job has ended');
  }

  static onlog(batch) {
    batch.forEach((log) => {
      core.info(`log: ${log}`);
    });
  }
}
export default AWS;
