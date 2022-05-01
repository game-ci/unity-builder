import AWS from 'aws-sdk';
import { CliFunction } from '../../../../cli/cli-functions-repository';
import Input from '../../../../input';
import CloudRunnerLogger from '../../../services/cloud-runner-logger';
import { BaseStackFormation } from '../cloud-formations/base-stack-formation';
import { TaskDefinitionFormation } from '../cloud-formations/task-definition-formation';

export class AwsCliCommands {
  @CliFunction(`aws-list-all`, `List all resources`)
  static async awsListAll() {
    await AwsCliCommands.awsListStacks();
    await AwsCliCommands.awsListTasks();
    await AwsCliCommands.awsListLogGroups();
  }
  @CliFunction(`aws-list-stacks`, `List stacks`)
  static async awsListStacks(perResultCallback: any = false) {
    process.env.AWS_REGION = Input.region;
    const CF = new AWS.CloudFormation();
    const stacks =
      (await CF.listStacks().promise()).StackSummaries?.filter(
        (_x) =>
          _x.StackStatus !== 'DELETE_COMPLETE' &&
          _x.TemplateDescription === TaskDefinitionFormation.description.replace('\n', ''),
      ) || [];
    CloudRunnerLogger.log(`Stacks ${stacks.length}`);
    for (const element of stacks) {
      if (perResultCallback) await perResultCallback(element);
    }
    const baseStacks =
      (await CF.listStacks().promise()).StackSummaries?.filter(
        (_x) =>
          _x.StackStatus !== 'DELETE_COMPLETE' && _x.TemplateDescription === BaseStackFormation.baseStackDecription,
      ) || [];
    CloudRunnerLogger.log(`Base Stacks ${baseStacks.length}`);
    for (const element of baseStacks) {
      if (perResultCallback) await perResultCallback(element);
    }
    if (stacks === undefined) {
      return;
    }
  }
  @CliFunction(`aws-list-tasks`, `List tasks`)
  static async awsListTasks(perResultCallback: any = false) {
    process.env.AWS_REGION = Input.region;
    const ecs = new AWS.ECS();
    const clusters = (await ecs.listClusters().promise()).clusterArns || [];
    CloudRunnerLogger.log(`Clusters ${clusters.length}`);
    for (const element of clusters) {
      const input: AWS.ECS.ListTasksRequest = {
        cluster: element,
      };
      const list = (await ecs.listTasks(input).promise()).taskArns || [];
      if (list.length > 0) {
        const describeInput: AWS.ECS.DescribeTasksRequest = { tasks: list, cluster: element };
        const describeList = (await ecs.describeTasks(describeInput).promise()).tasks || [];
        if (describeList === []) {
          continue;
        }
        CloudRunnerLogger.log(`Tasks ${describeList.length}`);
        for (const taskElement of describeList) {
          if (taskElement === undefined) {
            continue;
          }
          taskElement.overrides = {};
          taskElement.attachments = [];
          if (taskElement.createdAt === undefined) {
            CloudRunnerLogger.log(`Skipping ${taskElement.taskDefinitionArn} no createdAt date`);
            continue;
          }
          if (perResultCallback) await perResultCallback(taskElement, element);
        }
      }
    }
  }
  @CliFunction(`aws-list-log-groups`, `List tasks`)
  static async awsListLogGroups(perResultCallback: any = false) {
    process.env.AWS_REGION = Input.region;
    const ecs = new AWS.CloudWatchLogs();
    const logStreamInput: AWS.CloudWatchLogs.DescribeLogGroupsRequest = { logGroupNamePrefix: 'game-ci' };
    const logGroups = (await ecs.describeLogGroups(logStreamInput).promise()).logGroups || [];
    CloudRunnerLogger.log(`Log Groups ${logGroups.length}`);
    for (const element of logGroups) {
      if (element.creationTime === undefined) {
        CloudRunnerLogger.log(`Skipping ${element.logGroupName} no createdAt date`);
        continue;
      }
      if (perResultCallback) await perResultCallback(element, element);
    }
  }

  @CliFunction(`aws-garbage-collect`, `garbage collect aws`)
  static async garbageCollectAws() {
    await AwsCliCommands.cleanup(false);
  }
  @CliFunction(`aws-garbage-collect-all`, `garbage collect aws`)
  static async garbageCollectAwsAll() {
    await AwsCliCommands.cleanup(true);
  }
  @CliFunction(`aws-garbage-collect-all-1d-older`, `garbage collect aws`)
  static async garbageCollectAwsAllOlderThanOneDay() {
    await AwsCliCommands.cleanup(true);
  }

  private static async cleanup(deleteResources = false) {
    process.env.AWS_REGION = Input.region;
    const CF = new AWS.CloudFormation();
    const ecs = new AWS.ECS();
    await AwsCliCommands.awsListStacks(async (element) => {
      if (deleteResources) {
        if (element.StackName === 'game-ci' || element.TemplateDescription === 'Game-CI base stack') {
          CloudRunnerLogger.log(`Skipping ${element.StackName} ignore list`);

          return;
        }
        const deleteStackInput: AWS.CloudFormation.DeleteStackInput = { StackName: element.StackName };
        await CF.deleteStack(deleteStackInput).promise();
      }
    });
    await AwsCliCommands.awsListTasks(async (taskElement, element) => {
      if (deleteResources) {
        await ecs.stopTask({ task: taskElement.taskArn || '', cluster: element }).promise();
      }
    });
  }
}
