import AWS from 'aws-sdk';
import { CliFunction } from '../../../../cli/cli-functions-repository';
import Input from '../../../../input';
import CloudRunnerLogger from '../../../services/cloud-runner-logger';

export class AwsCliCommands {
  @CliFunction(`aws-list-stacks`, `List stacks`)
  static async awsListStacks(perResultCallback: any) {
    process.env.AWS_REGION = Input.region;
    const CF = new AWS.CloudFormation();
    const stacks =
      (await CF.listStacks().promise()).StackSummaries?.filter((_x) => _x.StackStatus !== 'DELETE_COMPLETE') || [];
    CloudRunnerLogger.log(`DescribeStacksRequest ${stacks.length}`);
    for (const element of stacks) {
      CloudRunnerLogger.log(JSON.stringify(element, undefined, 4));
      CloudRunnerLogger.log(`${element.StackName}`);
      if (perResultCallback) await perResultCallback(element);
    }
    if (stacks === undefined) {
      return;
    }
  }
  @CliFunction(`aws-list-tasks`, `List tasks`)
  static async awsListTasks(perResultCallback: any) {
    process.env.AWS_REGION = Input.region;
    CloudRunnerLogger.log(`ECS Clusters`);
    const ecs = new AWS.ECS();
    const clusters = (await ecs.listClusters().promise()).clusterArns || [];
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
        CloudRunnerLogger.log(`DescribeTasksRequest ${describeList.length}`);
        for (const taskElement of describeList) {
          if (taskElement === undefined) {
            continue;
          }
          taskElement.overrides = {};
          taskElement.attachments = [];
          CloudRunnerLogger.log(JSON.stringify(taskElement, undefined, 4));
          if (taskElement.createdAt === undefined) {
            CloudRunnerLogger.log(`Skipping ${taskElement.taskDefinitionArn} no createdAt date`);
            continue;
          }
          if (perResultCallback) await perResultCallback(taskElement, element);
        }
      }
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
    await AwsCliCommands.cleanup(true, 24);
  }

  private static async cleanup(deleteResources = false, olderThanAgeInHours = 0) {
    process.env.AWS_REGION = Input.region;
    const CF = new AWS.CloudFormation();
    const ecs = new AWS.ECS();
    AwsCliCommands.awsListStacks(async (element) => {
      if (
        deleteResources &&
        new Date(Date.now()).getUTCMilliseconds() - element.CreationTime.getUTCMilliseconds() > olderThanAgeInHours
      ) {
        if (element.StackName === 'game-ci' || element.TemplateDescription === 'Game-CI base stack') {
          CloudRunnerLogger.log(`Skipping ${element.StackName} ignore list`);

          return;
        }
        const deleteStackInput: AWS.CloudFormation.DeleteStackInput = { StackName: element.StackName };
        await CF.deleteStack(deleteStackInput).promise();
      }
    });
    AwsCliCommands.awsListTasks(async (taskElement, element) => {
      if (
        deleteResources &&
        new Date(Date.now()).getUTCMilliseconds() - taskElement.createdAt.getUTCMilliseconds() > olderThanAgeInHours
      ) {
        await ecs.stopTask({ task: taskElement.taskArn || '', cluster: element }).promise();
      }
    });
  }
}
