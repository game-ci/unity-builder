import { CliFunction } from '../../../../cli/cli-functions-repository';
import { TaskService } from '../services/task-service';
import { GarbageCollectionService } from '../services/garbage-collection-service';
import { TertiaryResourcesService } from '../services/tertiary-resources-service';
export class AwsCliCommands {
  @CliFunction(`aws-list-all`, `List all resources`)
  public static async awsListAll() {
    await AwsCliCommands.awsListStacks();
    await AwsCliCommands.awsListTasks();
    await AwsCliCommands.awsListLogGroups();
  }
  @CliFunction(`aws-garbage-collect-list`, `garbage collect aws resources not in use !WIP!`)
  static async garbageCollectAws() {
    await GarbageCollectionService.cleanup(false);
  }
  @CliFunction(`aws-garbage-collect-all`, `garbage collect aws resources regardless of whether they are in use`)
  static async garbageCollectAwsAll() {
    await GarbageCollectionService.cleanup(true);
  }
  @CliFunction(
    `aws-garbage-collect-all-1d-older`,
    `garbage collect aws resources created more than 1d ago (ignore if they are in use)`,
  )
  static async garbageCollectAwsAllOlderThanOneDay() {
    await GarbageCollectionService.cleanup(true, true);
  }

  @CliFunction(`aws-list-stacks`, `List stacks`)
  static async awsListStacks(perResultCallback: any = false) {
    return TaskService.awsListStacks(perResultCallback);
  }
  @CliFunction(`aws-list-tasks`, `List tasks`)
  static async awsListTasks(perResultCallback: any = false) {
    return TaskService.awsListJobs(perResultCallback);
  }

  @CliFunction(`aws-list-log-groups`, `List tasks`)
  static async awsListLogGroups(perResultCallback: any = false) {
    await TertiaryResourcesService.AwsListLogGroups(perResultCallback);
  }

  @CliFunction(`aws-list-jobs`, `List tasks`)
  public static async awsListJobs(perResultCallback: any = false) {
    return TaskService.awsListJobs(perResultCallback);
  }

  @CliFunction(`list-tasks`, `List tasks`)
  static async listTasks(perResultCallback: any = false) {
    return TaskService.awsListJobs(perResultCallback);
  }

  @CliFunction(`watch`, `List tasks`)
  static async watchTasks() {
    return TaskService.watch();
  }

  @CliFunction(`describe-resource`, `desribe tasks`)
  static async describe(options) {
    // return CloudRunner.Provider.inspect();
    return await TaskService.awsDescribeJob(options.select);
  }
}
