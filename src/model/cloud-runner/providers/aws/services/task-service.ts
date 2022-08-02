import AWS from 'aws-sdk';
import Input from '../../../../input';
import CloudRunnerLogger from '../../../services/cloud-runner-logger';
import { BaseStackFormation } from '../cloud-formations/base-stack-formation';

export class TaskService {
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

      // if (verbose)
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

      // if (verbose)
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

      // if (verbose)
      CloudRunnerLogger.log(
        `Task Stack ${element.StackName} - Age D${Math.floor(
          ageDate.getHours() / 24,
        )} H${ageDate.getHours()} M${ageDate.getMinutes()}`,
      );
      if (perResultCallback) await perResultCallback(element);
    }
  }
}
