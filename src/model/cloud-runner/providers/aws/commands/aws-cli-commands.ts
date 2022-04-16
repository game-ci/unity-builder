import AWS from 'aws-sdk';
import { CliFunction } from '../../../../cli/cli-functions-repository';
import Input from '../../../../input';
import CloudRunnerLogger from '../../../services/cloud-runner-logger';

export class AwsCliCommands {
  @CliFunction(`aws-garbage-collect`, `garbage collect aws`)
  static async garbageCollectAws() {
    process.env.AWS_REGION = Input.region;
    CloudRunnerLogger.log(`Cloud Formation stacks`);
    const CF = new AWS.CloudFormation();
    const stacks =
      (await CF.listStacks().promise()).StackSummaries?.filter((_x) => _x.StackStatus !== 'DELETE_COMPLETE') || [];
    for (const element of stacks) {
      CloudRunnerLogger.log(JSON.stringify(element, undefined, 4));
    }
    CloudRunnerLogger.log(`ECS Clusters`);
    const ecs = new AWS.ECS();
    const clusters = (await ecs.listClusters().promise()).clusterArns || [];
    if (stacks === undefined) {
      return;
    }
    for (const element of clusters) {
      const input: AWS.ECS.ListTasksRequest = {
        cluster: element,
      };
      CloudRunnerLogger.log(JSON.stringify(await ecs.listTasks(input).promise(), undefined, 4));
    }
  }
  @CliFunction(`aws-garbage-collect-all`, `garbage collect aws`)
  static async garbageCollectAwsAll() {
    process.env.AWS_REGION = Input.region;
    CloudRunnerLogger.log(`Cloud Formation stacks`);
    const CF = new AWS.CloudFormation();
    CloudRunnerLogger.log(`ECS Clusters`);
    const ecs = new AWS.ECS();
    const clusters = (await ecs.listClusters().promise()).clusterArns || [];
    for (const element of clusters) {
      const input: AWS.ECS.ListTasksRequest = {
        cluster: element,
      };
      const list = (await ecs.listTasks(input).promise()).taskArns || [];
      if (list.length > 0) {
        CloudRunnerLogger.log(`DescribeTasksRequest`);
        CloudRunnerLogger.log(JSON.stringify(list, undefined, 4));
        const describeInput: AWS.ECS.DescribeTasksRequest = { tasks: list, cluster: element };
        const describeList = (await ecs.describeTasks(describeInput).promise()).tasks || [];
        if (describeList === []) {
          continue;
        }
        for (const taskElement of describeList) {
          if (taskElement === undefined) {
            continue;
          }
          taskElement.overrides = {};
          taskElement.attachments = [];
          CloudRunnerLogger.log(JSON.stringify(taskElement, undefined, 4));
          await ecs.stopTask({ task: taskElement.taskArn || '', cluster: element }).promise();
        }
      }

      await ecs.deleteCluster({ cluster: element }).promise();
    }
    const stacks =
      (await CF.listStacks().promise()).StackSummaries?.filter((_x) => _x.StackStatus !== 'DELETE_COMPLETE') || [];
    for (const element of stacks) {
      CloudRunnerLogger.log(JSON.stringify(element, undefined, 4));
      const deleteStackInput: AWS.CloudFormation.DeleteStackInput = { StackName: element.StackName };
      await CF.deleteStack(deleteStackInput).promise();
    }
    if (stacks === undefined) {
      return;
    }
  }
}
