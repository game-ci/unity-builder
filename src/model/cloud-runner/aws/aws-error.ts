import CloudRunnerLogger from '../services/cloud-runner-logger';
import * as SDK from 'aws-sdk';
import * as core from '@actions/core';

export class AWSError {
  static async handleStackCreationFailure(error: any, CF: SDK.CloudFormation, taskDefStackName: string) {
    CloudRunnerLogger.log('aws error: ');
    core.error(JSON.stringify(error, undefined, 4));
    CloudRunnerLogger.log('Getting events and resources for task stack');
    const events = (await CF.describeStackEvents({ StackName: taskDefStackName }).promise()).StackEvents?.filter(
      (x) => {
        x.ResourceStatus === `CREATE_FAILED`;
      },
    );
    const resources = (await CF.describeStackResources({ StackName: taskDefStackName }).promise()).StackResources;
    CloudRunnerLogger.log(JSON.stringify(events, undefined, 4));
    CloudRunnerLogger.log(JSON.stringify(resources, undefined, 4));
  }
}
