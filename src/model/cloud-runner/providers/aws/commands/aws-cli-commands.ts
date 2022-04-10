import AWS from 'aws-sdk';
import { CliFunction } from '../../../../cli/cli-functions-repository';
import Input from '../../../../input';
import CloudRunnerLogger from '../../../services/cloud-runner-logger';

export class AwsCliCommands {
  @CliFunction(`aws-garbage-collect`, `garbage collect aws`)
  static async garbageCollectAws() {
    process.env.AWS_REGION = Input.region;
    CloudRunnerLogger.log(`Cloud Formation stacks`);
    const CF = new AWS.CloudFormation();
    const stacks =
      (await CF.listStacks().promise()).StackSummaries?.filter((_x) => _x.StackStatus !== 'DELETE_COMPLETE') || [];
    for (const element of stacks) {
      CloudRunnerLogger.log(JSON.stringify(element, undefined, 4));
    }
    CloudRunnerLogger.log(`ECS Clusters`);
    const ecs = new AWS.ECS();
    const clusters = (await ecs.listClusters().promise()).clusterArns || [];
    if (stacks === undefined) {
      return;
    }
    for (const element of clusters) {
      const input: AWS.ECS.ListTasksRequest = {
        cluster: element,
      };
      CloudRunnerLogger.log(JSON.stringify(await ecs.listTasks(input).promise(), undefined, 4));
    }
  }
}
