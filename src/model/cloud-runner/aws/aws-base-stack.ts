import CloudRunnerLogger from '../services/cloud-runner-logger';
import * as core from '@actions/core';
import * as SDK from 'aws-sdk';
import * as fs from 'fs';
const crypto = require('crypto');

export class AWSBaseStack {
  constructor(baseStackName: string) {
    this.baseStackName = baseStackName;
  }
  private baseStackName: string;

  async setupBaseStack(CF: SDK.CloudFormation) {
    const baseStackName = this.baseStackName;
    const baseStack = fs.readFileSync(`${__dirname}/cloud-formations/base-setup.yml`, 'utf8');

    // Cloud Formation Input
    const describeStackInput: SDK.CloudFormation.DescribeStacksInput = {
      StackName: baseStackName,
    };
    const parametersWithoutHash: SDK.CloudFormation.Parameter[] = [
      { ParameterKey: 'EnvironmentName', ParameterValue: baseStackName },
      { ParameterKey: 'Storage', ParameterValue: `${baseStackName}-storage` },
    ];
    const hash = crypto
      .createHash('md5')
      .update(baseStack + JSON.stringify(parametersWithoutHash))
      .digest('hex');
    const parameters: SDK.CloudFormation.Parameter[] = [
      ...parametersWithoutHash,
      ...[{ ParameterKey: 'Version', ParameterValue: hash }],
    ];
    const updateInput: SDK.CloudFormation.UpdateStackInput = {
      StackName: baseStackName,
      TemplateBody: baseStack,
      Parameters: parameters,
      Capabilities: ['CAPABILITY_IAM'],
    };
    const createStackInput: SDK.CloudFormation.CreateStackInput = {
      StackName: baseStackName,
      TemplateBody: baseStack,
      Parameters: parameters,
      Capabilities: ['CAPABILITY_IAM'],
    };

    const stacks = (
      await CF.listStacks({ StackStatusFilter: ['UPDATE_COMPLETE', 'CREATE_COMPLETE'] }).promise()
    ).StackSummaries?.map((x) => x.StackName);
    const stackExists: Boolean = stacks?.includes(baseStackName) || false;
    const describeStack = async () => {
      return await CF.describeStacks(describeStackInput).promise();
    };
    try {
      if (!stackExists) {
        CloudRunnerLogger.log(`${baseStackName} stack does not exist (${JSON.stringify(stacks)})`);
        await CF.createStack(createStackInput).promise();
        CloudRunnerLogger.log(`created stack (version: ${hash})`);
      }
      const CFState = await describeStack();
      let stack = CFState.Stacks?.[0];
      if (!stack) {
        throw new Error(`Base stack doesn't exist, even after creation, stackExists check: ${stackExists}`);
      }
      const stackVersion = stack.Parameters?.find((x) => x.ParameterKey === 'Version')?.ParameterValue;

      if (stack.StackStatus === 'CREATE_IN_PROGRESS') {
        await CF.waitFor('stackCreateComplete', describeStackInput).promise();
      }

      if (stackExists) {
        CloudRunnerLogger.log(`Base stack exists (version: ${stackVersion}, local version: ${hash})`);
        if (hash !== stackVersion) {
          CloudRunnerLogger.log(`Updating`);
          await CF.updateStack(updateInput).promise();
        } else {
          CloudRunnerLogger.log(`No update required`);
        }
        stack = (await describeStack()).Stacks?.[0];
        if (!stack) {
          throw new Error(
            `Base stack doesn't exist, even after updating and creation, stackExists check: ${stackExists}`,
          );
        }
        if (stack.StackStatus === 'UPDATE_IN_PROGRESS') {
          await CF.waitFor('stackUpdateComplete', describeStackInput).promise();
        }
      }
      CloudRunnerLogger.log('base stack is ready');
    } catch (error) {
      core.error(JSON.stringify(await describeStack(), undefined, 4));
      throw error;
    }
  }
}
