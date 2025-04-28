import CloudRunnerLogger from '../../services/core/cloud-runner-logger';
import { CloudFormation, DescribeStackEventsCommand } from '@aws-sdk/client-cloudformation';
import * as core from '@actions/core';
import CloudRunner from '../../cloud-runner';

export class AWSError {
  static async handleStackCreationFailure(error: any, CF: CloudFormation, taskDefStackName: string) {
    CloudRunnerLogger.log('aws error: ');
    core.error(JSON.stringify(error, undefined, 4));
    if (CloudRunner.buildParameters.cloudRunnerDebug) {
      CloudRunnerLogger.log('Getting events and resources for task stack');
      const events = (await CF.send(new DescribeStackEventsCommand({ StackName: taskDefStackName }))).StackEvents;
      CloudRunnerLogger.log(JSON.stringify(events, undefined, 4));
    }
  }
}
