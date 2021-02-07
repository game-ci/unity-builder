/* eslint-disable no-plusplus */
/* eslint-disable no-await-in-loop */
import * as SDK from 'aws-sdk';
import { nanoid } from 'nanoid';

const fs = require('fs');
const core = require('@actions/core');
const kcl = require('aws-kcl');

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

    const taskDefStackName = `${stackName}-taskDef-${image}-${nanoid()}`
      .toString()
      .replace(/[^\da-z]/gi, '');
    core.info("Task Definition doesn't exist, creating a task definition stack");
    const taskDefCloudFormation = fs.readFileSync(`${__dirname}/task-def-formation.yml`, 'utf8');
    await CF.createStack({
      StackName: taskDefStackName,
      TemplateBody: taskDefCloudFormation,
      Capabilities: ['CAPABILITY_IAM'],
      Parameters: [
        {
          ParameterKey: 'ImageUrl',
          ParameterValue: image,
        },
        {
          ParameterKey: 'ServiceName',
          ParameterValue: taskDefStackName,
        },
      ],
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
      launchType: 'FARGATE',
      overrides: {
        containerOverrides: [
          {
            name: taskDefStackName,
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
    kcl({
      initialize: (initializeInput, completeCallback) => {
        // Your application specific initialization logic.

        // After initialization is done, call completeCallback,
        // to let the KCL know that the initialize operation is
        // complete.
        completeCallback();
      },
      processRecords: (processRecordsInput, completeCallback) => {
        // Sample code for record processing.
        if (!processRecordsInput || !processRecordsInput.records) {
          // Invoke callback to tell the KCL to process next batch
          // of records.
          completeCallback();
          return;
        }
        const { records } = processRecordsInput;
        let record;
        let sequenceNumber;
        let partitionKey;
        let data;
        // eslint-disable-next-line no-restricted-syntax
        for (const element of records) {
          record = element;
          sequenceNumber = record.sequenceNumber;
          partitionKey = record.partitionKey;
          // Data is in base64 format.
          data = Buffer.from(record.data, 'base64').toString();
          // Record processing logic here.
          core.info(data);
        }
        // Checkpoint last sequence number.
        processRecordsInput.checkpointer.checkpoint(sequenceNumber, (_error, sn) => {
          // Error handling logic. In this case, we call
          // completeCallback to process more data.
          completeCallback();
        });
      },
      shutdown: (shutdownInput, completeCallback) => {
        // Your shutdown logic.

        if (shutdownInput.reason !== 'TERMINATE') {
          completeCallback();
          return;
        }
        shutdownInput.checkpointer.checkpoint((err) => {
          // Error handling logic.
          // Invoke the callback at the end to mark the shutdown
          // operation complete.
          completeCallback();
        });
      },
    }).run();

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
