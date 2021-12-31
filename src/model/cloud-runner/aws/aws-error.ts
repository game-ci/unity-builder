import CloudRunnerLogger from '../services/cloud-runner-logger';
import * as SDK from 'aws-sdk';
import * as core from '@actions/core';
import { Input } from '../..';

export class AWSError {
  static async handleStackCreationFailure(error: any, CF: SDK.CloudFormation, taskDefStackName: string) {
    CloudRunnerLogger.log('aws error: ');
    core.error(JSON.stringify(error, undefined, 4));
    if (Input.cloudRunnerTests) {
      CloudRunnerLogger.log('Getting events and resources for task stack');
      const events = (await CF.describeStackEvents({ StackName: taskDefStackName }).promise()).StackEvents;
      CloudRunnerLogger.log(JSON.stringify(events, undefined, 4));
    }
  }
}
