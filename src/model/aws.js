/* eslint-disable no-plusplus */
/* eslint-disable no-await-in-loop */
import * as SDK from 'aws-sdk';

const WebSocketClient = require('websocket').client;
const fs = require('fs');
const core = require('@actions/core');

class AWS {
  static async runBuildJob(buildParameters, baseImage) {
    await this.run(buildParameters.awsStackName, baseImage.toString());
  }

  static async run(stackName, image) {
    const ECS = new SDK.ECS();
    const CF = new SDK.CloudFormation();

    const alphanumericImageName = image.toString().replace(/[^0-9a-z]/gi, '');
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
            // command: ["echo 't'"],
            // environment: []
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
    const taskDescriptions = await ECS.describeTasks({ tasks: [task.tasks[0].taskArn] }).promise();
    core.info(taskDescriptions.tasks[0]);
    // const client = new WebSocketClient('ws://');
    // client.on('connect', (con) => {
    //   con.on('message', (message) => {
    //     core.info(message);
    //   });
    // });

    await this.watch(async () => {
      return (
        await ECS.describeTasks({ tasks: [task.tasks[0].taskArn], cluster: clusterName }).promise()
      ).tasks[0].lastStatus;
    }, 'example');

    await ECS.waitFor('tasksStopped', {
      cluster: clusterName,
      tasks: [task.tasks[0].taskArn],
    }).promise();

    core.info('Build job has ended');
  }
}
export default AWS;
