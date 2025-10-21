import {
  CloudFormation,
  DescribeStackResourcesCommand,
  DescribeStacksCommand,
  ListStacksCommand,
  StackSummary,
} from '@aws-sdk/client-cloudformation';
import {
  CloudWatchLogs,
  DescribeLogGroupsCommand,
  DescribeLogGroupsCommandInput,
  LogGroup,
} from '@aws-sdk/client-cloudwatch-logs';
import {
  DescribeTasksCommand,
  DescribeTasksCommandInput,
  ECS,
  ListClustersCommand,
  ListTasksCommand,
  ListTasksCommandInput,
  Task,
} from '@aws-sdk/client-ecs';
import { ListObjectsCommand, ListObjectsCommandInput, S3 } from '@aws-sdk/client-s3';
import Input from '../../../../input';
import CloudRunnerLogger from '../../../services/core/cloud-runner-logger';
import { BaseStackFormation } from '../cloud-formations/base-stack-formation';
import AwsTaskRunner from '../aws-task-runner';
import CloudRunner from '../../../cloud-runner';

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
    const result: StackSummary[] = [];
    CloudRunnerLogger.log(``);
    CloudRunnerLogger.log(`List Cloud Formation Stacks`);
    process.env.AWS_REGION = Input.region;
    const CF = new CloudFormation({ region: Input.region });
    const stacks =
      (await CF.send(new ListStacksCommand({}))).StackSummaries?.filter(
        (_x) =>
          _x.StackStatus !== 'DELETE_COMPLETE' && _x.TemplateDescription !== BaseStackFormation.baseStackDecription,
      ) || [];
    CloudRunnerLogger.log(``);
    CloudRunnerLogger.log(`Cloud Formation Stacks ${stacks.length}`);
    for (const element of stacks) {
      if (!element.CreationTime) {
        CloudRunnerLogger.log(`${element.StackName} due to undefined CreationTime`);
      }

      const ageDate: Date = new Date(Date.now() - (element.CreationTime?.getTime() ?? 0));

      CloudRunnerLogger.log(
        `Task Stack ${element.StackName} - Age D${Math.floor(
          ageDate.getHours() / 24,
        )} H${ageDate.getHours()} M${ageDate.getMinutes()}`,
      );
      result.push(element);
    }
    const baseStacks =
      (await CF.send(new ListStacksCommand({}))).StackSummaries?.filter(
        (_x) =>
          _x.StackStatus !== 'DELETE_COMPLETE' && _x.TemplateDescription === BaseStackFormation.baseStackDecription,
      ) || [];
    CloudRunnerLogger.log(``);
    CloudRunnerLogger.log(`Base Stacks ${baseStacks.length}`);
    for (const element of baseStacks) {
      if (!element.CreationTime) {
        CloudRunnerLogger.log(`${element.StackName} due to undefined CreationTime`);
      }

      const ageDate: Date = new Date(Date.now() - (element.CreationTime?.getTime() ?? 0));

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
    const result: { taskElement: Task; element: string }[] = [];
    CloudRunnerLogger.log(``);
    CloudRunnerLogger.log(`List Tasks`);
    process.env.AWS_REGION = Input.region;
    const ecs = new ECS({ region: Input.region });
    const clusters = (await ecs.send(new ListClustersCommand({}))).clusterArns || [];
    CloudRunnerLogger.log(`Task Clusters ${clusters.length}`);
    for (const element of clusters) {
      const input: ListTasksCommandInput = {
        cluster: element,
      };

      const list = (await ecs.send(new ListTasksCommand(input))).taskArns || [];
      if (list.length > 0) {
        const describeInput: DescribeTasksCommandInput = { tasks: list, cluster: element };
        const describeList = (await ecs.send(new DescribeTasksCommand(describeInput))).tasks || [];
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
    const CF = new CloudFormation({ region: Input.region });
    try {
      const stack =
        (await CF.send(new ListStacksCommand({}))).StackSummaries?.find((_x) => _x.StackName === job) || undefined;
      const stackInfo = (await CF.send(new DescribeStackResourcesCommand({ StackName: job }))) || undefined;
      const stackInfo2 = (await CF.send(new DescribeStacksCommand({ StackName: job }))) || undefined;
      if (stack === undefined) {
        throw new Error('stack not defined');
      }
      if (!stack.CreationTime) {
        CloudRunnerLogger.log(`${stack.StackName} due to undefined CreationTime`);
      }
      const ageDate: Date = new Date(Date.now() - (stack.CreationTime?.getTime() ?? 0));
      const message = `
    Task Stack ${stack.StackName}
    Age D${Math.floor(ageDate.getHours() / 24)} H${ageDate.getHours()} M${ageDate.getMinutes()}
    ${JSON.stringify(stack, undefined, 4)}
    ${JSON.stringify(stackInfo, undefined, 4)}
    ${JSON.stringify(stackInfo2, undefined, 4)}
    `;
      CloudRunnerLogger.log(message);

      return message;
    } catch (error) {
      CloudRunnerLogger.error(
        `Failed to describe job ${job}: ${error instanceof Error ? error.message : String(error)}`,
      );
      throw error;
    }
  }
  public static async getLogGroups() {
    const result: Array<LogGroup> = [];
    process.env.AWS_REGION = Input.region;
    const ecs = new CloudWatchLogs();
    let logStreamInput: DescribeLogGroupsCommandInput = {
      /* logGroupNamePrefix: 'game-ci' */
    };
    let logGroupsDescribe = await ecs.send(new DescribeLogGroupsCommand(logStreamInput));
    const logGroups = logGroupsDescribe.logGroups || [];
    while (logGroupsDescribe.nextToken) {
      logStreamInput = { /* logGroupNamePrefix: 'game-ci',*/ nextToken: logGroupsDescribe.nextToken };
      logGroupsDescribe = await ecs.send(new DescribeLogGroupsCommand(logStreamInput));
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
    const s3 = new S3({ region: Input.region });
    const listRequest: ListObjectsCommandInput = {
      Bucket: CloudRunner.buildParameters.awsStackName,
    };

    const results = await s3.send(new ListObjectsCommand(listRequest));

    return results.Contents || [];
  }
}
