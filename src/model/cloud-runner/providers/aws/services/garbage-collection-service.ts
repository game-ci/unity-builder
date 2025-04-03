import {
  CloudFormation,
  DeleteStackCommand,
  DeleteStackCommandInput,
  DescribeStackResourcesCommand,
} from '@aws-sdk/client-cloudformation';
import { CloudWatchLogs, DeleteLogGroupCommand } from '@aws-sdk/client-cloudwatch-logs';
import { ECS, StopTaskCommand } from '@aws-sdk/client-ecs';
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
    const CF = new CloudFormation({ region: Input.region });
    const ecs = new ECS({ region: Input.region });
    const cwl = new CloudWatchLogs({ region: Input.region });
    const taskDefinitionsInUse = new Array();
    const tasks = await TaskService.getTasks();

    for (const task of tasks) {
      const { taskElement, element } = task;
      taskDefinitionsInUse.push(taskElement.taskDefinitionArn);
      if (deleteResources && (!OneDayOlderOnly || GarbageCollectionService.isOlderThan1day(taskElement.createdAt!))) {
        CloudRunnerLogger.log(`Stopping task ${taskElement.containers?.[0].name}`);
        await ecs.send(new StopTaskCommand({ task: taskElement.taskArn || '', cluster: element }));
      }
    }

    const jobStacks = await TaskService.getCloudFormationJobStacks();
    for (const element of jobStacks) {
      if (
        (await CF.send(new DescribeStackResourcesCommand({ StackName: element.StackName }))).StackResources?.some(
          (x) => x.ResourceType === 'AWS::ECS::TaskDefinition' && taskDefinitionsInUse.includes(x.PhysicalResourceId),
        )
      ) {
        CloudRunnerLogger.log(`Skipping ${element.StackName} - active task was running not deleting`);

        return;
      }

      if (
        deleteResources &&
        (!OneDayOlderOnly || (element.CreationTime && GarbageCollectionService.isOlderThan1day(element.CreationTime)))
      ) {
        if (element.StackName === 'game-ci' || element.TemplateDescription === 'Game-CI base stack') {
          CloudRunnerLogger.log(`Skipping ${element.StackName} ignore list`);

          return;
        }

        CloudRunnerLogger.log(`Deleting ${element.StackName}`);
        const deleteStackInput: DeleteStackCommandInput = { StackName: element.StackName };
        await CF.send(new DeleteStackCommand(deleteStackInput));
      }
    }
    const logGroups = await TaskService.getLogGroups();
    for (const element of logGroups) {
      if (
        deleteResources &&
        (!OneDayOlderOnly || GarbageCollectionService.isOlderThan1day(new Date(element.creationTime!)))
      ) {
        CloudRunnerLogger.log(`Deleting ${element.logGroupName}`);
        await cwl.send(new DeleteLogGroupCommand({ logGroupName: element.logGroupName || '' }));
      }
    }

    const locks = await TaskService.getLocks();
    for (const element of locks) {
      CloudRunnerLogger.log(`Lock: ${element.Key}`);
    }
  }
}
