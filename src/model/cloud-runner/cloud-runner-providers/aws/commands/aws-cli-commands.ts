import AWS from 'aws-sdk';
import { CliFunction } from '../../../../cli/cli-decorator';
import Input from '../../../../input';
import CloudRunnerLogger from '../../../services/cloud-runner-logger';

export class AWSCLICommands {
  @CliFunction(`garbage-collect-aws`, `garbage collect aws`)
  static async garbageCollectAws() {
    process.env.AWS_REGION = Input.region;
    const CF = new AWS.CloudFormation();

    const stacks = (await CF.listStacks().promise()).StackSummaries?.filter(
      (_x) => _x.StackStatus !== 'DELETE_COMPLETE',
    );
    if (stacks === undefined) {
      return;
    }
    CloudRunnerLogger.log(`Cloud Formation stacks`);
    for (const element of stacks) {
      CloudRunnerLogger.log(JSON.stringify(element, undefined, 4));
      await CF.deleteStack({ StackName: element.StackName }).promise();
    }

    CloudRunnerLogger.log(`ECS Clusters`);
    const ecs = new AWS.ECS();
    CloudRunnerLogger.log(JSON.stringify(await ecs.listClusters().promise(), undefined, 4));
    CloudRunnerLogger.log(JSON.stringify(await ecs.describeClusters().promise(), undefined, 4));
  }
}
