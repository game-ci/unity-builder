import CloudRunnerLogger from '../cloud-runner-services/cloud-runner-logger';
import CloudRunnerSecret from '../cloud-runner-services/cloud-runner-secret';
import * as SDK from 'aws-sdk';
import * as core from '@actions/core';

export class AWSError {
  static async handleStackCreationFailure(
    error: any,
    CF: SDK.CloudFormation,
    taskDefStackName: string,
    taskDefCloudFormation: string,
    parameters: any[],
    secrets: CloudRunnerSecret[],
  ) {
    CloudRunnerLogger.log('aws stack parameters: ');
    CloudRunnerLogger.log(JSON.stringify(parameters, undefined, 4));

    CloudRunnerLogger.log('aws stack secrets: ');
    CloudRunnerLogger.log(JSON.stringify(secrets, undefined, 4));

    CloudRunnerLogger.log('aws stack: ');
    CloudRunnerLogger.log(taskDefCloudFormation);

    CloudRunnerLogger.log('aws error: ');
    core.error(error);
    CloudRunnerLogger.log('Getting events and resources for task stack');
    const events = (await CF.describeStackEvents({ StackName: taskDefStackName }).promise()).StackEvents;
    const resources = (await CF.describeStackResources({ StackName: taskDefStackName }).promise()).StackResources;
    CloudRunnerLogger.log(JSON.stringify(events, undefined, 4));
    CloudRunnerLogger.log(JSON.stringify(resources, undefined, 4));
  }
}
