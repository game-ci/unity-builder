import * as SDK from 'aws-sdk';
import CloudRunnerAWSTaskDef from './cloud-runner-aws-task-def';
import CloudRunnerSecret from '../../options/cloud-runner-secret';
import { AWSCloudFormationTemplates } from './aws-cloud-formation-templates';
import CloudRunnerLogger from '../../services/core/cloud-runner-logger';
import { AWSError } from './aws-error';
import CloudRunner from '../../cloud-runner';
import { CleanupCronFormation } from './cloud-formations/cleanup-cron-formation';
import CloudRunnerOptions from '../../options/cloud-runner-options';
import { TaskDefinitionFormation } from './cloud-formations/task-definition-formation';

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
    taskDefCloudFormation = taskDefCloudFormation.replace(
      `ContainerCpu:
    Default: 1024`,
      `ContainerCpu:
    Default: ${Number.parseInt(CloudRunner.buildParameters.containerCpu)}`,
    );
    taskDefCloudFormation = taskDefCloudFormation.replace(
      `ContainerMemory:
    Default: 2048`,
      `ContainerMemory:
    Default: ${Number.parseInt(CloudRunner.buildParameters.containerMemory)}`,
    );
    if (!CloudRunnerOptions.asyncCloudRunner) {
      taskDefCloudFormation = AWSCloudFormationTemplates.insertAtTemplate(
        taskDefCloudFormation,
        '# template resources logstream',
        TaskDefinitionFormation.streamLogs,
      );
    }
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
        '# template resources secrets',
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
    const logGroupName = `${this.baseStackName}/${taskDefStackName}`;
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
        ParameterKey: 'LogGroupName',
        ParameterValue: logGroupName,
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
      `Starting AWS job with memory: ${CloudRunner.buildParameters.containerMemory} cpu: ${CloudRunner.buildParameters.containerCpu}`,
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
          await new Promise((promise) => setTimeout(promise, 5000));
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
      CloudRunnerLogger.log(`Creating job aws formation ${taskDefStackName}`);
      await CF.createStack(createStackInput).promise();
      await CF.waitFor('stackCreateComplete', { StackName: taskDefStackName }).promise();
      const describeStack = await CF.describeStacks({ StackName: taskDefStackName }).promise();
      for (const parameter of parameters) {
        if (!describeStack.Stacks?.[0].Parameters?.some((x) => x.ParameterKey === parameter.ParameterKey)) {
          throw new Error(`Parameter ${parameter.ParameterKey} not found in stack`);
        }
      }
    } catch (error) {
      await AWSError.handleStackCreationFailure(error, CF, taskDefStackName);
      throw error;
    }

    const createCleanupStackInput: SDK.CloudFormation.CreateStackInput = {
      StackName: `${taskDefStackName}-cleanup`,
      TemplateBody: CleanupCronFormation.formation,
      Capabilities: ['CAPABILITY_IAM'],
      Parameters: [
        {
          ParameterKey: 'StackName',
          ParameterValue: taskDefStackName,
        },
        {
          ParameterKey: 'DeleteStackName',
          ParameterValue: `${taskDefStackName}-cleanup`,
        },
        {
          ParameterKey: 'TTL',
          ParameterValue: `1080`,
        },
        {
          ParameterKey: 'BUILDGUID',
          ParameterValue: CloudRunner.buildParameters.buildGuid,
        },
        {
          ParameterKey: 'EnvironmentName',
          ParameterValue: this.baseStackName,
        },
      ],
    };
    if (CloudRunnerOptions.useCleanupCron) {
      try {
        CloudRunnerLogger.log(`Creating job cleanup formation`);
        await CF.createStack(createCleanupStackInput).promise();

        // await CF.waitFor('stackCreateComplete', { StackName: createCleanupStackInput.StackName }).promise();
      } catch (error) {
        await AWSError.handleStackCreationFailure(error, CF, taskDefStackName);
        throw error;
      }
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
