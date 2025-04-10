import CloudRunnerLogger from '../../services/core/cloud-runner-logger';
import * as core from '@actions/core';
import {
  CloudFormation,
  CreateStackCommand,
  CreateStackCommandInput,
  DescribeStacksCommand,
  DescribeStacksCommandInput,
  ListStacksCommand,
  Parameter,
  UpdateStackCommand,
  UpdateStackCommandInput,
  waitUntilStackCreateComplete,
  waitUntilStackUpdateComplete,
} from '@aws-sdk/client-cloudformation';
import { BaseStackFormation } from './cloud-formations/base-stack-formation';
import crypto from 'node:crypto';

export class AWSBaseStack {
  constructor(baseStackName: string) {
    this.baseStackName = baseStackName;
  }
  private baseStackName: string;

  async setupBaseStack(CF: CloudFormation) {
    const baseStackName = this.baseStackName;

    const baseStack = BaseStackFormation.formation;

    // Cloud Formation Input
    const describeStackInput: DescribeStacksCommandInput = {
      StackName: baseStackName,
    };
    const parametersWithoutHash: Parameter[] = [{ ParameterKey: 'EnvironmentName', ParameterValue: baseStackName }];
    const parametersHash = crypto
      .createHash('md5')
      .update(baseStack + JSON.stringify(parametersWithoutHash))
      .digest('hex');
    const parameters: Parameter[] = [
      ...parametersWithoutHash,
      ...[{ ParameterKey: 'Version', ParameterValue: parametersHash }],
    ];
    const updateInput: UpdateStackCommandInput = {
      StackName: baseStackName,
      TemplateBody: baseStack,
      Parameters: parameters,
      Capabilities: ['CAPABILITY_IAM'],
    };
    const createStackInput: CreateStackCommandInput = {
      StackName: baseStackName,
      TemplateBody: baseStack,
      Parameters: parameters,
      Capabilities: ['CAPABILITY_IAM'],
    };

    const stacks = await CF.send(
      new ListStacksCommand({ StackStatusFilter: ['UPDATE_COMPLETE', 'CREATE_COMPLETE', 'ROLLBACK_COMPLETE'] }),
    );
    const stackNames = stacks.StackSummaries?.map((x) => x.StackName) || [];
    const stackExists: Boolean = stackNames.includes(baseStackName) || false;
    const describeStack = async () => {
      return await CF.send(new DescribeStacksCommand(describeStackInput));
    };
    try {
      if (!stackExists) {
        CloudRunnerLogger.log(`${baseStackName} stack does not exist (${JSON.stringify(stackNames)})`);
        await CF.send(new CreateStackCommand(createStackInput));
        CloudRunnerLogger.log(`created stack (version: ${parametersHash})`);
      }
      const CFState = await describeStack();
      let stack = CFState.Stacks?.[0];
      if (!stack) {
        throw new Error(`Base stack doesn't exist, even after creation, stackExists check: ${stackExists}`);
      }
      const stackVersion = stack.Parameters?.find((x) => x.ParameterKey === 'Version')?.ParameterValue;

      if (stack.StackStatus === 'CREATE_IN_PROGRESS') {
        await waitUntilStackCreateComplete(
          {
            client: CF,
            maxWaitTime: 200,
          },
          describeStackInput,
        );
      }

      if (stackExists) {
        CloudRunnerLogger.log(`Base stack exists (version: ${stackVersion}, local version: ${parametersHash})`);
        if (parametersHash !== stackVersion) {
          CloudRunnerLogger.log(`Attempting update of base stack`);
          try {
            await CF.send(new UpdateStackCommand(updateInput));
          } catch (error: any) {
            if (error['message'].includes('No updates are to be performed')) {
              CloudRunnerLogger.log(`No updates are to be performed`);
            } else {
              CloudRunnerLogger.log(`Update Failed (Stack name: ${baseStackName})`);
              CloudRunnerLogger.log(error['message']);
            }
            CloudRunnerLogger.log(`Continuing...`);
          }
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
          await waitUntilStackUpdateComplete(
            {
              client: CF,
              maxWaitTime: 200,
            },
            describeStackInput,
          );
        }
      }
      CloudRunnerLogger.log('base stack is now ready');
    } catch (error) {
      core.error(JSON.stringify(await describeStack(), undefined, 4));
      throw error;
    }
  }
}
