import * as SDK from 'aws-sdk';
import CloudRunnerSecret from '../services/cloud-runner-secret';
import CloudRunnerEnvironmentVariable from '../services/cloud-runner-environment-variable';
import CloudRunnerTaskDef from '../services/cloud-runner-task-def';
import AWSTaskRunner from './aws-task-runner';
import { CloudRunnerProviderInterface } from '../services/cloud-runner-provider-interface';
import BuildParameters from '../../build-parameters';
import CloudRunnerLogger from '../services/cloud-runner-logger';
import { AWSJobStack } from './aws-job-stack';
import { AWSBaseStack } from './aws-base-stack';
import { Input } from '../..';

class AWSBuildEnvironment implements CloudRunnerProviderInterface {
  private baseStackName: string;

  constructor(buildParameters: BuildParameters) {
    this.baseStackName = buildParameters.awsBaseStackName;
  }
  async cleanupSharedResources(
    // eslint-disable-next-line no-unused-vars
    buildGuid: string,
    // eslint-disable-next-line no-unused-vars
    buildParameters: BuildParameters,
    // eslint-disable-next-line no-unused-vars
    branchName: string,
    // eslint-disable-next-line no-unused-vars
    defaultSecretsArray: { ParameterKey: string; EnvironmentVariable: string; ParameterValue: string }[],
  ) {}
  async setupSharedResources(
    // eslint-disable-next-line no-unused-vars
    buildGuid: string,
    // eslint-disable-next-line no-unused-vars
    buildParameters: BuildParameters,
    // eslint-disable-next-line no-unused-vars
    branchName: string,
    // eslint-disable-next-line no-unused-vars
    defaultSecretsArray: { ParameterKey: string; EnvironmentVariable: string; ParameterValue: string }[],
  ) {}

  async runTask(
    buildId: string,
    image: string,
    commands: string[],
    mountdir: string,
    workingdir: string,
    environment: CloudRunnerEnvironmentVariable[],
    secrets: CloudRunnerSecret[],
  ): Promise<void> {
    process.env.AWS_REGION = Input.region;
    const ECS = new SDK.ECS();
    const CF = new SDK.CloudFormation();
    CloudRunnerLogger.log(`AWS Region: ${CF.config.region}`);
    const entrypoint = ['/bin/sh'];
    const t0 = Date.now();

    await new AWSBaseStack(this.baseStackName).setupBaseStack(CF);
    const taskDef = await new AWSJobStack(this.baseStackName).setupCloudFormations(
      CF,
      buildId,
      image,
      entrypoint,
      commands,
      mountdir,
      workingdir,
      secrets,
    );

    let t2;
    try {
      const t1 = Date.now();
      CloudRunnerLogger.log(`Setup job time: ${Math.floor((t1 - t0) / 1000)}s`);
      await AWSTaskRunner.runTask(taskDef, ECS, CF, environment, buildId, commands);
      t2 = Date.now();
      CloudRunnerLogger.log(`Run job time: ${Math.floor((t2 - t1) / 1000)}s`);
    } finally {
      await this.cleanupResources(CF, taskDef);
      const t3 = Date.now();
      if (t2 !== undefined) CloudRunnerLogger.log(`Cleanup job time: ${Math.floor((t3 - t2) / 1000)}s`);
    }
  }

  async cleanupResources(CF: SDK.CloudFormation, taskDef: CloudRunnerTaskDef) {
    CloudRunnerLogger.log('Cleanup starting');
    await CF.deleteStack({
      StackName: taskDef.taskDefStackName,
    }).promise();
    await CF.deleteStack({
      StackName: taskDef.taskDefStackNameTTL,
    }).promise();

    await CF.waitFor('stackDeleteComplete', {
      StackName: taskDef.taskDefStackName,
    }).promise();
    await CF.waitFor('stackDeleteComplete', {
      StackName: taskDef.taskDefStackNameTTL,
    }).promise();

    const stacks = (await CF.listStacks().promise()).StackSummaries?.filter((x) => x.StackStatus !== 'DELETE_COMPLETE');

    CloudRunnerLogger.log(`Deleted Stacks: ${taskDef.taskDefStackName}, ${taskDef.taskDefStackNameTTL}`);
    CloudRunnerLogger.log(`Stacks: ${JSON.stringify(stacks, undefined, 4)}`);

    CloudRunnerLogger.log('Cleanup complete');
  }
}
export default AWSBuildEnvironment;
