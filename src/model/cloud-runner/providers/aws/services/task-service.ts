import AWS from 'aws-sdk';
import Input from '../../../../input';
import CloudRunnerLogger from '../../../services/cloud-runner-logger';
import { BaseStackFormation } from '../cloud-formations/base-stack-formation';
import AwsTaskRunner from '../aws-task-runner';

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
  public static async awsListStacks(perResultCallback: any = false) {
    process.env.AWS_REGION = Input.region;
    const CF = new AWS.CloudFormation();
    const stacks =
      (await CF.listStacks().promise()).StackSummaries?.filter(
        (_x) => _x.StackStatus !== 'DELETE_COMPLETE', // &&
        // _x.TemplateDescription === TaskDefinitionFormation.description.replace('\n', ''),
      ) || [];
    CloudRunnerLogger.log(`Stacks ${stacks.length}`);
    for (const element of stacks) {
      const ageDate: Date = new Date(Date.now() - element.CreationTime.getTime());

      CloudRunnerLogger.log(
        `Task Stack ${element.StackName} - Age D${Math.floor(
          ageDate.getHours() / 24,
        )} H${ageDate.getHours()} M${ageDate.getMinutes()}`,
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
      const ageDate: Date = new Date(Date.now() - element.CreationTime.getTime());

      CloudRunnerLogger.log(
        `Task Stack ${element.StackName} - Age D${Math.floor(
          ageDate.getHours() / 24,
        )} H${ageDate.getHours()} M${ageDate.getMinutes()}`,
      );
      if (perResultCallback) await perResultCallback(element);
    }
    if (stacks === undefined) {
      return;
    }
  }
  public static async awsListTasks(perResultCallback: any = false) {
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
        if (describeList.length === 0) {
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
  public static async awsListJobs(perResultCallback: any = false) {
    process.env.AWS_REGION = Input.region;
    const CF = new AWS.CloudFormation();
    const stacks =
      (await CF.listStacks().promise()).StackSummaries?.filter(
        (_x) =>
          _x.StackStatus !== 'DELETE_COMPLETE' && _x.TemplateDescription !== BaseStackFormation.baseStackDecription,
      ) || [];
    CloudRunnerLogger.log(`Stacks ${stacks.length}`);
    for (const element of stacks) {
      const ageDate: Date = new Date(Date.now() - element.CreationTime.getTime());

      CloudRunnerLogger.log(
        `Task Stack ${element.StackName} - Age D${Math.floor(
          ageDate.getHours() / 24,
        )} H${ageDate.getHours()} M${ageDate.getMinutes()}`,
      );
      if (perResultCallback) await perResultCallback(element);
    }
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
}
