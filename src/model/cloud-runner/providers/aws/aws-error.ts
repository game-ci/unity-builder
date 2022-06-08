import CloudRunnerLogger from '../../services/cloud-runner-logger.ts';
import { core, aws } from '../../dependencies.ts';
import CloudRunner from '../../cloud-runner.ts';

export class AWSError {
  static async handleStackCreationFailure(error: any, CF: aws.CloudFormation, taskDefStackName: string) {
    CloudRunnerLogger.log('aws error: ');
    core.error(JSON.stringify(error, undefined, 4));
    if (CloudRunner.buildParameters.cloudRunnerIntegrationTests) {
      CloudRunnerLogger.log('Getting events and resources for task stack');
      const events = (await CF.describeStackEvents({ StackName: taskDefStackName }).promise()).StackEvents;
      CloudRunnerLogger.log(JSON.stringify(events, undefined, 4));
    }
  }
}
