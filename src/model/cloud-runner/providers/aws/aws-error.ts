import CloudRunnerLogger from '../../services/core/cloud-runner-logger';
import * as SDK from 'aws-sdk';
import * as core from '@actions/core';
import CloudRunner from '../../cloud-runner';

export class AWSError {
  static async handleStackCreationFailure(error: any, CF: SDK.CloudFormation, taskDefStackName: string) {
    CloudRunnerLogger.log('aws error: ');
    core.error(JSON.stringify(error, undefined, 4));
    if (CloudRunner.buildParameters.cloudRunnerDebug) {
      CloudRunnerLogger.log('Getting events and resources for task stack');
      const events = (await CF.describeStackEvents({ StackName: taskDefStackName }).promise()).StackEvents;
      CloudRunnerLogger.log(JSON.stringify(events, undefined, 4));
    }
  }
}
