/* eslint-disable no-plusplus */
/* eslint-disable no-await-in-loop */
import * as SDK from 'aws-sdk';
import { nanoid } from 'nanoid';
import { CloudWatch, CloudWatchLogs } from 'aws-sdk';

const fs = require('fs');
const core = require('@actions/core');

class AWS {
  static async runBuildJob(buildParameters, baseImage) {
    await this.run(
      buildParameters.awsStackName,
      'alpine/git',
      ['clone', `https://github.com/${process.env.GITHUB_REPOSITORY}.git`, `repo`],
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
      [],
    );
  }

  static async run(stackName, image, commands, environment) {
    const ECS = new SDK.ECS();
    const CF = new SDK.CloudFormation();

    const alphanumericImageName = image.toString().replace(/[^\da-z]/gi, '');
    const taskDefStackName = `${stackName}-taskDef-${alphanumericImageName}-${nanoid()}`;
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
            environment,
            command: commands,
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

    // watching logs

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
