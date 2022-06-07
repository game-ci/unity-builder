import * as SDK from 'aws-sdk';
import CloudRunnerAWSTaskDef from './cloud-runner-aws-task-def.ts';
import CloudRunnerSecret from '../../services/cloud-runner-secret.ts';
import { AWSCloudFormationTemplates } from './aws-cloud-formation-templates.ts';
import CloudRunnerLogger from '../../services/cloud-runner-logger.ts';
import { AWSError } from './aws-error.ts';
import CloudRunner from '../../cloud-runner.ts';

export class AWSJobStack {
  private baseStackName: string;
  constructor(baseStackName: string) {
    this.baseStackName = baseStackName;
  }

  public async setupCloudFormations(
    CF: SDK.CloudFormation,
    buildGuid: string,
    image: string,
    entrypoint: string[],
    commands: string,
    mountdir: string,
    workingdir: string,
    secrets: CloudRunnerSecret[],
  ): Promise<CloudRunnerAWSTaskDef> {
    const taskDefStackName = `${this.baseStackName}-${buildGuid}`;
    let taskDefCloudFormation = AWSCloudFormationTemplates.readTaskCloudFormationTemplate();
    const cpu = CloudRunner.buildParameters.cloudRunnerCpu || '1024';
    const memory = CloudRunner.buildParameters.cloudRunnerMemory || '3072';
    taskDefCloudFormation = taskDefCloudFormation.replace(
      `ContainerCpu:
    Default: 1024`,
      `ContainerCpu:
    Default: ${Number.parseInt(cpu)}`,
    );
    taskDefCloudFormation = taskDefCloudFormation.replace(
      `ContainerMemory:
    Default: 2048`,
      `ContainerMemory:
    Default: ${Number.parseInt(memory)}`,
    );
    for (const secret of secrets) {
      secret.ParameterKey = `${buildGuid.replace(/[^\dA-Za-z]/g, '')}${secret.ParameterKey.replace(
        /[^\dA-Za-z]/g,
        '',
      )}`;
      if (typeof secret.ParameterValue == 'number') {
        secret.ParameterValue = `${secret.ParameterValue}`;
      }
      if (!secret.ParameterValue || secret.ParameterValue === '') {
        secrets = secrets.filter((x) => x !== secret);
        continue;
      }
      taskDefCloudFormation = AWSCloudFormationTemplates.insertAtTemplate(
        taskDefCloudFormation,
        'p1 - input',
        AWSCloudFormationTemplates.getParameterTemplate(secret.ParameterKey),
      );
      taskDefCloudFormation = AWSCloudFormationTemplates.insertAtTemplate(
        taskDefCloudFormation,
        'p2 - secret',
        AWSCloudFormationTemplates.getSecretTemplate(`${secret.ParameterKey}`),
      );
      taskDefCloudFormation = AWSCloudFormationTemplates.insertAtTemplate(
        taskDefCloudFormation,
        'p3 - container def',
        AWSCloudFormationTemplates.getSecretDefinitionTemplate(secret.EnvironmentVariable, secret.ParameterKey),
      );
    }
    const secretsMappedToCloudFormationParameters = secrets.map((x) => {
      return { ParameterKey: x.ParameterKey.replace(/[^\dA-Za-z]/g, ''), ParameterValue: x.ParameterValue };
    });
    const parameters = [
      {
        ParameterKey: 'EnvironmentName',
        ParameterValue: this.baseStackName,
      },
      {
        ParameterKey: 'ImageUrl',
        ParameterValue: image,
      },
      {
        ParameterKey: 'ServiceName',
        ParameterValue: taskDefStackName,
      },
      {
        ParameterKey: 'Command',
        ParameterValue: 'echo "this template should be overwritten when running a task"',
      },
      {
        ParameterKey: 'EntryPoint',
        ParameterValue: entrypoint.join(','),
      },
      {
        ParameterKey: 'WorkingDirectory',
        ParameterValue: workingdir,
      },
      {
        ParameterKey: 'EFSMountDirectory',
        ParameterValue: mountdir,
      },
      ...secretsMappedToCloudFormationParameters,
    ];
    CloudRunnerLogger.log(
      `Starting AWS job with memory: ${CloudRunner.buildParameters.cloudRunnerMemory} cpu: ${CloudRunner.buildParameters.cloudRunnerCpu}`,
    );
    let previousStackExists = true;
    while (previousStackExists) {
      previousStackExists = false;
      const stacks = await CF.listStacks().promise();
      if (!stacks.StackSummaries) {
        throw new Error('Faild to get stacks');
      }
      for (let index = 0; index < stacks.StackSummaries.length; index++) {
        const element = stacks.StackSummaries[index];
        if (element.StackName === taskDefStackName && element.StackStatus !== 'DELETE_COMPLETE') {
          previousStackExists = true;
          CloudRunnerLogger.log(`Previous stack still exists: ${JSON.stringify(element)}`);
        }
      }
    }
    const createStackInput: SDK.CloudFormation.CreateStackInput = {
      StackName: taskDefStackName,
      TemplateBody: taskDefCloudFormation,
      Capabilities: ['CAPABILITY_IAM'],
      Parameters: parameters,
    };

    try {
      await CF.createStack(createStackInput).promise();
      CloudRunnerLogger.log('Creating cloud runner job');
      await CF.waitFor('stackCreateComplete', { StackName: taskDefStackName }).promise();
    } catch (error) {
      await AWSError.handleStackCreationFailure(error, CF, taskDefStackName);
      throw error;
    }

    const taskDefResources = (
      await CF.describeStackResources({
        StackName: taskDefStackName,
      }).promise()
    ).StackResources;

    const baseResources = (await CF.describeStackResources({ StackName: this.baseStackName }).promise()).StackResources;

    return {
      taskDefStackName,
      taskDefCloudFormation,
      taskDefResources,
      baseResources,
    };
  }
}
