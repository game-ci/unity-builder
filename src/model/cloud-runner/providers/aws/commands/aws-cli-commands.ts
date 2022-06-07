import AWS from 'aws-sdk';
import { CliFunction } from '../../../../cli/cli-functions-repository.ts';
import Input from '../../../../input.ts';
import CloudRunnerLogger from '../../../services/cloud-runner-logger.ts';
import { BaseStackFormation } from '../cloud-formations/base-stack-formation.ts';

export class AwsCliCommands {
  @CliFunction(`aws-list-all`, `List all resources`)
  static async awsListAll() {
    await AwsCliCommands.awsListStacks(undefined, true);
    await AwsCliCommands.awsListTasks();
    await AwsCliCommands.awsListLogGroups(undefined, true);
  }
  @CliFunction(`aws-garbage-collect`, `garbage collect aws resources not in use !WIP!`)
  static async garbageCollectAws() {
    await AwsCliCommands.cleanup(false);
  }
  @CliFunction(`aws-garbage-collect-all`, `garbage collect aws resources regardless of whether they are in use`)
  static async garbageCollectAwsAll() {
    await AwsCliCommands.cleanup(true);
  }
  @CliFunction(
    `aws-garbage-collect-all-1d-older`,
    `garbage collect aws resources created more than 1d ago (ignore if they are in use)`,
  )
  static async garbageCollectAwsAllOlderThanOneDay() {
    await AwsCliCommands.cleanup(true, true);
  }
  static isOlderThan1day(date: any) {
    const ageDate = new Date(date.getTime() - Date.now());

    return ageDate.getDay() > 0;
  }
  @CliFunction(`aws-list-stacks`, `List stacks`)
  static async awsListStacks(perResultCallback: any = false, verbose: boolean = false) {
    process.env.AWS_REGION = Input.region;
    const CF = new AWS.CloudFormation();
    const stacks =
      (await CF.listStacks().promise()).StackSummaries?.filter(
        (_x) => _x.StackStatus !== 'DELETE_COMPLETE', // &&
        // _x.TemplateDescription === TaskDefinitionFormation.description.replace('\n', ''),
      ) || [];
    CloudRunnerLogger.log(`Stacks ${stacks.length}`);
    for (const element of stacks) {
      const ageDate = new Date(element.CreationTime.getTime() - Date.now());
      if (verbose)
        CloudRunnerLogger.log(
          `Task Stack ${element.StackName} - Age D${ageDate.getDay()} H${ageDate.getHours()} M${ageDate.getMinutes()}`,
        );
      if (perResultCallback) await perResultCallback(element);
    }
    const baseStacks =
      (await CF.listStacks().promise()).StackSummaries?.filter(
        (_x) =>
          _x.StackStatus !== 'DELETE_COMPLETE' && _x.TemplateDescription === BaseStackFormation.baseStackDecription,
      ) || [];
    CloudRunnerLogger.log(`Base Stacks ${baseStacks.length}`);
    for (const element of baseStacks) {
      const ageDate = new Date(element.CreationTime.getTime() - Date.now());
      if (verbose)
        CloudRunnerLogger.log(
          `Base Stack ${
            element.StackName
          } - Age D${ageDate.getHours()} H${ageDate.getHours()} M${ageDate.getMinutes()}`,
        );
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
  static async awsListLogGroups(perResultCallback: any = false, verbose: boolean = false) {
    process.env.AWS_REGION = Input.region;
    const ecs = new AWS.CloudWatchLogs();
    let logStreamInput: AWS.CloudWatchLogs.DescribeLogGroupsRequest = {
      /* logGroupNamePrefix: 'game-ci' */
    };
    let logGroupsDescribe = await ecs.describeLogGroups(logStreamInput).promise();
    const logGroups = logGroupsDescribe.logGroups || [];
    while (logGroupsDescribe.nextToken) {
      logStreamInput = { /* logGroupNamePrefix: 'game-ci',*/ nextToken: logGroupsDescribe.nextToken };
      logGroupsDescribe = await ecs.describeLogGroups(logStreamInput).promise();
      logGroups.push(...(logGroupsDescribe?.logGroups || []));
    }

    CloudRunnerLogger.log(`Log Groups ${logGroups.length}`);
    for (const element of logGroups) {
      if (element.creationTime === undefined) {
        CloudRunnerLogger.log(`Skipping ${element.logGroupName} no createdAt date`);
        continue;
      }
      const ageDate = new Date(new Date(element.creationTime).getTime() - Date.now());
      if (verbose)
        CloudRunnerLogger.log(
          `Log Group Name ${
            element.logGroupName
          } - Age D${ageDate.getDay()} H${ageDate.getHours()} M${ageDate.getMinutes()} - 1d old ${AwsCliCommands.isOlderThan1day(
            new Date(element.creationTime),
          )}`,
        );
      if (perResultCallback) await perResultCallback(element, element);
    }
  }

  private static async cleanup(deleteResources = false, OneDayOlderOnly: boolean = false) {
    process.env.AWS_REGION = Input.region;
    const CF = new AWS.CloudFormation();
    const ecs = new AWS.ECS();
    const cwl = new AWS.CloudWatchLogs();
    await AwsCliCommands.awsListStacks(async (element) => {
      if (deleteResources && (!OneDayOlderOnly || AwsCliCommands.isOlderThan1day(element.CreationTime))) {
        if (element.StackName === 'game-ci' || element.TemplateDescription === 'Game-CI base stack') {
          CloudRunnerLogger.log(`Skipping ${element.StackName} ignore list`);

          return;
        }
        CloudRunnerLogger.log(`Deleting ${element.logGroupName}`);
        const deleteStackInput: AWS.CloudFormation.DeleteStackInput = { StackName: element.StackName };
        await CF.deleteStack(deleteStackInput).promise();
      }
    });
    await AwsCliCommands.awsListTasks(async (taskElement, element) => {
      if (deleteResources && (!OneDayOlderOnly || AwsCliCommands.isOlderThan1day(taskElement.CreatedAt))) {
        CloudRunnerLogger.log(`Stopping task ${taskElement.containers?.[0].name}`);
        await ecs.stopTask({ task: taskElement.taskArn || '', cluster: element }).promise();
      }
    });
    await AwsCliCommands.awsListLogGroups(async (element) => {
      if (deleteResources && (!OneDayOlderOnly || AwsCliCommands.isOlderThan1day(new Date(element.createdAt)))) {
        CloudRunnerLogger.log(`Deleting ${element.logGroupName}`);
        await cwl.deleteLogGroup({ logGroupName: element.logGroupName || '' }).promise();
      }
    });
  }
}
