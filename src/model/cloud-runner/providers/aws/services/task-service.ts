import AWS from 'aws-sdk';
import Input from '../../../../input';
import CloudRunnerLogger from '../../../services/core/cloud-runner-logger';
import { BaseStackFormation } from '../cloud-formations/base-stack-formation';
import AwsTaskRunner from '../aws-task-runner';
import { ListObjectsRequest } from 'aws-sdk/clients/s3';
import CloudRunner from '../../../cloud-runner';
import { StackSummaries } from 'aws-sdk/clients/cloudformation';
import { LogGroups } from 'aws-sdk/clients/cloudwatchlogs';

export class TaskService {
  static async watch() {
    // eslint-disable-next-line no-unused-vars
    const { output, shouldCleanup } = await AwsTaskRunner.streamLogsUntilTaskStops(
      process.env.cluster || ``,
      process.env.taskArn || ``,
      process.env.streamName || ``,
    );

    return output;
  }
  public static async getCloudFormationJobStacks() {
    const result: StackSummaries = [];
    CloudRunnerLogger.log(``);
    CloudRunnerLogger.log(`List Cloud Formation Stacks`);
    process.env.AWS_REGION = Input.region;
    const CF = new AWS.CloudFormation();
    const stacks =
      (await CF.listStacks().promise()).StackSummaries?.filter(
        (_x) =>
          _x.StackStatus !== 'DELETE_COMPLETE' && _x.TemplateDescription !== BaseStackFormation.baseStackDecription,
      ) || [];
    CloudRunnerLogger.log(``);
    CloudRunnerLogger.log(`Cloud Formation Stacks ${stacks.length}`);
    for (const element of stacks) {
      const ageDate: Date = new Date(Date.now() - element.CreationTime.getTime());

      CloudRunnerLogger.log(
        `Task Stack ${element.StackName} - Age D${Math.floor(
          ageDate.getHours() / 24,
        )} H${ageDate.getHours()} M${ageDate.getMinutes()}`,
      );
      result.push(element);
    }
    const baseStacks =
      (await CF.listStacks().promise()).StackSummaries?.filter(
        (_x) =>
          _x.StackStatus !== 'DELETE_COMPLETE' && _x.TemplateDescription === BaseStackFormation.baseStackDecription,
      ) || [];
    CloudRunnerLogger.log(``);
    CloudRunnerLogger.log(`Base Stacks ${baseStacks.length}`);
    for (const element of baseStacks) {
      const ageDate: Date = new Date(Date.now() - element.CreationTime.getTime());

      CloudRunnerLogger.log(
        `Task Stack ${element.StackName} - Age D${Math.floor(
          ageDate.getHours() / 24,
        )} H${ageDate.getHours()} M${ageDate.getMinutes()}`,
      );
      result.push(element);
    }
    CloudRunnerLogger.log(``);

    return result;
  }
  public static async getTasks() {
    const result: { taskElement: AWS.ECS.Task; element: string }[] = [];
    CloudRunnerLogger.log(``);
    CloudRunnerLogger.log(`List Tasks`);
    process.env.AWS_REGION = Input.region;
    const ecs = new AWS.ECS();
    const clusters = (await ecs.listClusters().promise()).clusterArns || [];
    CloudRunnerLogger.log(`Task Clusters ${clusters.length}`);
    for (const element of clusters) {
      const input: AWS.ECS.ListTasksRequest = {
        cluster: element,
      };

      const list = (await ecs.listTasks(input).promise()).taskArns || [];
      if (list.length > 0) {
        const describeInput: AWS.ECS.DescribeTasksRequest = { tasks: list, cluster: element };
        const describeList = (await ecs.describeTasks(describeInput).promise()).tasks || [];
        if (describeList.length === 0) {
          CloudRunnerLogger.log(`No Tasks`);
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
          result.push({ taskElement, element });
        }
      }
    }
    CloudRunnerLogger.log(``);

    return result;
  }
  public static async awsDescribeJob(job: string) {
    process.env.AWS_REGION = Input.region;
    const CF = new AWS.CloudFormation();
    const stack = (await CF.listStacks().promise()).StackSummaries?.find((_x) => _x.StackName === job) || undefined;
    const stackInfo = (await CF.describeStackResources({ StackName: job }).promise()) || undefined;
    const stackInfo2 = (await CF.describeStacks({ StackName: job }).promise()) || undefined;
    if (stack === undefined) {
      throw new Error('stack not defined');
    }
    const ageDate: Date = new Date(Date.now() - stack.CreationTime.getTime());
    const message = `
    Task Stack ${stack.StackName}
    Age D${Math.floor(ageDate.getHours() / 24)} H${ageDate.getHours()} M${ageDate.getMinutes()}
    ${JSON.stringify(stack, undefined, 4)}
    ${JSON.stringify(stackInfo, undefined, 4)}
    ${JSON.stringify(stackInfo2, undefined, 4)}
    `;
    CloudRunnerLogger.log(message);

    return message;
  }
  public static async getLogGroups() {
    const result: LogGroups = [];
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
      const ageDate: Date = new Date(Date.now() - element.creationTime);

      CloudRunnerLogger.log(
        `Task Stack ${element.logGroupName} - Age D${Math.floor(
          ageDate.getHours() / 24,
        )} H${ageDate.getHours()} M${ageDate.getMinutes()}`,
      );
      result.push(element);
    }

    return result;
  }
  public static async getLocks() {
    process.env.AWS_REGION = Input.region;
    const s3 = new AWS.S3();
    const listRequest: ListObjectsRequest = {
      Bucket: CloudRunner.buildParameters.awsStackName,
    };
    const results = await s3.listObjects(listRequest).promise();

    return results.Contents || [];
  }
}
