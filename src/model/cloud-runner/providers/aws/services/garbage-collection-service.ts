import AWS from 'aws-sdk';
import Input from '../../../../input';
import CloudRunnerLogger from '../../../services/core/cloud-runner-logger';
import { TaskService } from './task-service';

export class GarbageCollectionService {
  static isOlderThan1day(date: Date) {
    const ageDate = new Date(date.getTime() - Date.now());

    return ageDate.getDay() > 0;
  }

  public static async cleanup(deleteResources = false, OneDayOlderOnly: boolean = false) {
    process.env.AWS_REGION = Input.region;
    const CF = new AWS.CloudFormation();
    const ecs = new AWS.ECS();
    const cwl = new AWS.CloudWatchLogs();
    const taskDefinitionsInUse = new Array();
    const tasks = await TaskService.getTasks();

    for (const task of tasks) {
      const { taskElement, element } = task;
      taskDefinitionsInUse.push(taskElement.taskDefinitionArn);
      if (deleteResources && (!OneDayOlderOnly || GarbageCollectionService.isOlderThan1day(taskElement.createdAt!))) {
        CloudRunnerLogger.log(`Stopping task ${taskElement.containers?.[0].name}`);
        await ecs.stopTask({ task: taskElement.taskArn || '', cluster: element }).promise();
      }
    }

    const jobStacks = await TaskService.getCloudFormationJobStacks();
    for (const element of jobStacks) {
      if (
        (await CF.describeStackResources({ StackName: element.StackName }).promise()).StackResources?.some(
          (x) => x.ResourceType === 'AWS::ECS::TaskDefinition' && taskDefinitionsInUse.includes(x.PhysicalResourceId),
        )
      ) {
        CloudRunnerLogger.log(`Skipping ${element.StackName} - active task was running not deleting`);

        return;
      }

      if (deleteResources && (!OneDayOlderOnly || GarbageCollectionService.isOlderThan1day(element.CreationTime))) {
        if (element.StackName === 'game-ci' || element.TemplateDescription === 'Game-CI base stack') {
          CloudRunnerLogger.log(`Skipping ${element.StackName} ignore list`);

          return;
        }

        CloudRunnerLogger.log(`Deleting ${element.StackName}`);
        const deleteStackInput: AWS.CloudFormation.DeleteStackInput = { StackName: element.StackName };
        await CF.deleteStack(deleteStackInput).promise();
      }
    }
    const logGroups = await TaskService.getLogGroups();
    for (const element of logGroups) {
      if (
        deleteResources &&
        (!OneDayOlderOnly || GarbageCollectionService.isOlderThan1day(new Date(element.creationTime!)))
      ) {
        CloudRunnerLogger.log(`Deleting ${element.logGroupName}`);
        await cwl.deleteLogGroup({ logGroupName: element.logGroupName || '' }).promise();
      }
    }

    const locks = await TaskService.getLocks();
    for (const element of locks) {
      CloudRunnerLogger.log(`Lock: ${element.Key}`);
    }
  }
}
