import CloudRunnerLogger from '../../services/cloud-runner-logger.ts';
import { aws } from '../../../../dependencies.ts';
import CloudRunner from '../../cloud-runner.ts';

export class AWSError {
  static async handleStackCreationFailure(error: any, CF: aws.CloudFormation, taskDefStackName: string) {
    CloudRunnerLogger.log('aws error: ');
    log.error(JSON.stringify(error, undefined, 4));
    if (CloudRunner.buildParameters.cloudRunnerIntegrationTests) {
      CloudRunnerLogger.log('Getting events and resources for task stack');
      const stackEventsDescription = await CF.describeStackEvents({ StackName: taskDefStackName }).promise();
      const events = stackEventsDescription.StackEvents;
      CloudRunnerLogger.log(JSON.stringify(events, undefined, 4));
    }
  }
}
