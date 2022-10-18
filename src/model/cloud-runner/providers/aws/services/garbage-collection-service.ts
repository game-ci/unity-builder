import AWS from 'aws-sdk';
import Input from '../../../../input';
import CloudRunnerLogger from '../../../services/cloud-runner-logger';
import { TaskService } from './task-service';
import { TertiaryResourcesService } from './tertiary-resources-service';

export class GarbageCollectionService {
  static isOlderThan1day(date: any) {
    const ageDate = new Date(date.getTime() - Date.now());

    return ageDate.getDay() > 0;
  }

  public static async cleanup(deleteResources = false, OneDayOlderOnly: boolean = false) {
    process.env.AWS_REGION = Input.region;
    const CF = new AWS.CloudFormation();
    const ecs = new AWS.ECS();
    const cwl = new AWS.CloudWatchLogs();
    const taskDefinitionsInUse = new Array();
    await TaskService.awsListTasks(async (taskElement, element) => {
      taskDefinitionsInUse.push(taskElement.taskDefinitionArn);
      if (deleteResources && (!OneDayOlderOnly || GarbageCollectionService.isOlderThan1day(taskElement.CreatedAt))) {
        CloudRunnerLogger.log(`Stopping task ${taskElement.containers?.[0].name}`);
        await ecs.stopTask({ task: taskElement.taskArn || '', cluster: element }).promise();
      }
    });
    await TaskService.awsListStacks(async (element) => {
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
        CloudRunnerLogger.log(`Deleting ${element.logGroupName}`);
        const deleteStackInput: AWS.CloudFormation.DeleteStackInput = { StackName: element.StackName };
        await CF.deleteStack(deleteStackInput).promise();
      }
    });
    await TertiaryResourcesService.awsListLogGroups(async (element) => {
      if (
        deleteResources &&
        (!OneDayOlderOnly || GarbageCollectionService.isOlderThan1day(new Date(element.createdAt)))
      ) {
        CloudRunnerLogger.log(`Deleting ${element.logGroupName}`);
        await cwl.deleteLogGroup({ logGroupName: element.logGroupName || '' }).promise();
      }
    });
  }
}
