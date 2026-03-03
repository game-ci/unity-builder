import {
  DescribeStackResourcesCommand,
  DescribeStacksCommand,
  ListStacksCommand,
} from '@aws-sdk/client-cloudformation';
import type { StackSummary } from '@aws-sdk/client-cloudformation';
// eslint-disable-next-line import/named
import { DescribeLogGroupsCommand, DescribeLogGroupsCommandInput } from '@aws-sdk/client-cloudwatch-logs';
import type { LogGroup } from '@aws-sdk/client-cloudwatch-logs';
import { DescribeTasksCommand, ListClustersCommand, ListTasksCommand } from '@aws-sdk/client-ecs';
import type { Task } from '@aws-sdk/client-ecs';
import { ListObjectsV2Command } from '@aws-sdk/client-s3';
import Input from '../../../../input';
import OrchestratorLogger from '../../../services/core/orchestrator-logger';
import { BaseStackFormation } from '../cloud-formations/base-stack-formation';
import AwsTaskRunner from '../aws-task-runner';
import Orchestrator from '../../../orchestrator';
import { AwsClientFactory } from '../aws-client-factory';
import SharedWorkspaceLocking from '../../../services/core/shared-workspace-locking';

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
  public static async getCloudFormationJobStacks(): Promise<StackSummary[]> {
    const result: StackSummary[] = [];
    OrchestratorLogger.log(``);
    OrchestratorLogger.log(`List Cloud Formation Stacks`);
    process.env.AWS_REGION = Input.region;
    const CF = AwsClientFactory.getCloudFormation();
    const stacks =
      (await CF.send(new ListStacksCommand({}))).StackSummaries?.filter(
        (_x) =>
          _x.StackStatus !== 'DELETE_COMPLETE' && _x.TemplateDescription !== BaseStackFormation.baseStackDecription,
      ) || [];
    OrchestratorLogger.log(``);
    OrchestratorLogger.log(`Cloud Formation Stacks ${stacks.length}`);
    for (const element of stacks) {
      if (!element.CreationTime) {
        OrchestratorLogger.log(`${element.StackName} due to undefined CreationTime`);
      }

      const ageDate: Date = new Date(Date.now() - (element.CreationTime?.getTime() ?? 0));

      OrchestratorLogger.log(
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
    OrchestratorLogger.log(``);
    OrchestratorLogger.log(`Base Stacks ${baseStacks.length}`);
    for (const element of baseStacks) {
      if (!element.CreationTime) {
        OrchestratorLogger.log(`${element.StackName} due to undefined CreationTime`);
      }

      const ageDate: Date = new Date(Date.now() - (element.CreationTime?.getTime() ?? 0));

      OrchestratorLogger.log(
        `Task Stack ${element.StackName} - Age D${Math.floor(
          ageDate.getHours() / 24,
        )} H${ageDate.getHours()} M${ageDate.getMinutes()}`,
      );
      result.push(element);
    }
    OrchestratorLogger.log(``);

    return result;
  }
  public static async getTasks(): Promise<{ taskElement: Task; element: string }[]> {
    const result: { taskElement: Task; element: string }[] = [];
    OrchestratorLogger.log(``);
    OrchestratorLogger.log(`List Tasks`);
    process.env.AWS_REGION = Input.region;
    const ecs = AwsClientFactory.getECS();
    const clusters: string[] = [];
    {
      let nextToken: string | undefined;
      do {
        const clusterResponse = await ecs.send(new ListClustersCommand({ nextToken }));
        clusters.push(...(clusterResponse.clusterArns ?? []));
        nextToken = clusterResponse.nextToken;
      } while (nextToken);
    }
    OrchestratorLogger.log(`Task Clusters ${clusters.length}`);
    for (const element of clusters) {
      const taskArns: string[] = [];
      {
        let nextToken: string | undefined;
        do {
          const taskResponse = await ecs.send(new ListTasksCommand({ cluster: element, nextToken }));
          taskArns.push(...(taskResponse.taskArns ?? []));
          nextToken = taskResponse.nextToken;
        } while (nextToken);
      }
      if (taskArns.length > 0) {
        const describeInput = { tasks: taskArns, cluster: element };
        const describeList = (await ecs.send(new DescribeTasksCommand(describeInput))).tasks || [];
        if (describeList.length === 0) {
          OrchestratorLogger.log(`No Tasks`);
          continue;
        }
        OrchestratorLogger.log(`Tasks ${describeList.length}`);
        for (const taskElement of describeList) {
          if (taskElement === undefined) {
            continue;
          }
          if (taskElement.createdAt === undefined) {
            OrchestratorLogger.log(`Skipping ${taskElement.taskDefinitionArn} no createdAt date`);
            continue;
          }
          result.push({ taskElement, element });
        }
      }
    }
    OrchestratorLogger.log(``);

    return result;
  }
  public static async awsDescribeJob(job: string) {
    process.env.AWS_REGION = Input.region;
    const CF = AwsClientFactory.getCloudFormation();
    try {
      const stack =
        (await CF.send(new ListStacksCommand({}))).StackSummaries?.find((_x) => _x.StackName === job) || undefined;
      const stackInfo = (await CF.send(new DescribeStackResourcesCommand({ StackName: job }))) || undefined;
      const stackInfo2 = (await CF.send(new DescribeStacksCommand({ StackName: job }))) || undefined;
      if (stack === undefined) {
        throw new Error('stack not defined');
      }
      if (!stack.CreationTime) {
        OrchestratorLogger.log(`${stack.StackName} due to undefined CreationTime`);
      }
      const ageDate: Date = new Date(Date.now() - (stack.CreationTime?.getTime() ?? 0));
      const message = `
    Task Stack ${stack.StackName}
    Age D${Math.floor(ageDate.getHours() / 24)} H${ageDate.getHours()} M${ageDate.getMinutes()}
    ${JSON.stringify(stack, undefined, 4)}
    ${JSON.stringify(stackInfo, undefined, 4)}
    ${JSON.stringify(stackInfo2, undefined, 4)}
    `;
      OrchestratorLogger.log(message);

      return message;
    } catch (error) {
      OrchestratorLogger.error(
        `Failed to describe job ${job}: ${error instanceof Error ? error.message : String(error)}`,
      );
      throw error;
    }
  }
  public static async getLogGroups(): Promise<LogGroup[]> {
    const result: LogGroup[] = [];
    process.env.AWS_REGION = Input.region;
    const cwl = AwsClientFactory.getCloudWatchLogs();
    let logStreamInput: DescribeLogGroupsCommandInput = {
      /* logGroupNamePrefix: 'game-ci' */
    };
    let logGroupsDescribe = await cwl.send(new DescribeLogGroupsCommand(logStreamInput));
    const logGroups = logGroupsDescribe.logGroups || [];
    while (logGroupsDescribe.nextToken) {
      logStreamInput = {
        /* logGroupNamePrefix: 'game-ci',*/
        nextToken: logGroupsDescribe.nextToken,
      };
      logGroupsDescribe = await cwl.send(new DescribeLogGroupsCommand(logStreamInput));
      logGroups.push(...(logGroupsDescribe?.logGroups || []));
    }

    OrchestratorLogger.log(`Log Groups ${logGroups.length}`);
    for (const element of logGroups) {
      if (element.creationTime === undefined) {
        OrchestratorLogger.log(`Skipping ${element.logGroupName} no createdAt date`);
        continue;
      }
      const ageDate: Date = new Date(Date.now() - element.creationTime);

      OrchestratorLogger.log(
        `Task Stack ${element.logGroupName} - Age D${Math.floor(
          ageDate.getHours() / 24,
        )} H${ageDate.getHours()} M${ageDate.getMinutes()}`,
      );
      result.push(element);
    }

    return result;
  }
  public static async getLocks(): Promise<Array<{ Key: string }>> {
    process.env.AWS_REGION = Input.region;
    if (Orchestrator.buildParameters.storageProvider === 'rclone') {
      // eslint-disable-next-line no-unused-vars
      type ListObjectsFunction = (prefix: string) => Promise<string[]>;
      const objects = await (SharedWorkspaceLocking as unknown as { listObjects: ListObjectsFunction }).listObjects('');

      return objects.map((x: string) => ({ Key: x }));
    }
    const s3 = AwsClientFactory.getS3();
    const listRequest = {
      Bucket: Orchestrator.buildParameters.awsStackName,
    };

    const results = await s3.send(new ListObjectsV2Command(listRequest));

    return (results.Contents || []).map((object) => ({ Key: object.Key || '' }));
  }
}
