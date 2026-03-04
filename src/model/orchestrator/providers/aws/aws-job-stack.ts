import {
  CloudFormation,
  CreateStackCommand,
  // eslint-disable-next-line import/named
  CreateStackCommandInput,
  DescribeStackResourcesCommand,
  DescribeStacksCommand,
  ListStacksCommand,
  waitUntilStackCreateComplete,
} from '@aws-sdk/client-cloudformation';
import OrchestratorAWSTaskDef from './orchestrator-aws-task-def';
import OrchestratorSecret from '../../options/orchestrator-secret';
import { AWSCloudFormationTemplates } from './aws-cloud-formation-templates';
import OrchestratorLogger from '../../services/core/orchestrator-logger';
import { AWSError } from './aws-error';
import Orchestrator from '../../orchestrator';
import { CleanupCronFormation } from './cloud-formations/cleanup-cron-formation';
import OrchestratorOptions from '../../options/orchestrator-options';
import { TaskDefinitionFormation } from './cloud-formations/task-definition-formation';

const DEFAULT_STACK_WAIT_TIME_SECONDS = 600;

function getStackWaitTime(): number {
  const overrideValue = Number(process.env.ORCHESTRATOR_AWS_STACK_WAIT_TIME ?? '');
  if (!Number.isNaN(overrideValue) && overrideValue > 0) {
    return overrideValue;
  }

  return DEFAULT_STACK_WAIT_TIME_SECONDS;
}

export class AWSJobStack {
  private baseStackName: string;
  constructor(baseStackName: string) {
    this.baseStackName = baseStackName;
  }

  public async setupCloudFormations(
    CF: CloudFormation,
    buildGuid: string,
    image: string,
    entrypoint: string[],
    commands: string,
    mountdir: string,
    workingdir: string,
    secrets: OrchestratorSecret[],
  ): Promise<OrchestratorAWSTaskDef> {
    const taskDefStackName = `${this.baseStackName}-${buildGuid}`;
    let taskDefCloudFormation = AWSCloudFormationTemplates.readTaskCloudFormationTemplate();
    taskDefCloudFormation = taskDefCloudFormation.replace(
      `ContainerCpu:
    Default: 1024`,
      `ContainerCpu:
    Default: ${Number.parseInt(Orchestrator.buildParameters.containerCpu)}`,
    );
    taskDefCloudFormation = taskDefCloudFormation.replace(
      `ContainerMemory:
    Default: 2048`,
      `ContainerMemory:
    Default: ${Number.parseInt(Orchestrator.buildParameters.containerMemory)}`,
    );
    if (!OrchestratorOptions.asyncOrchestrator) {
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
    OrchestratorLogger.log(
      `Starting AWS job with memory: ${Orchestrator.buildParameters.containerMemory} cpu: ${Orchestrator.buildParameters.containerCpu}`,
    );
    let previousStackExists = true;
    while (previousStackExists) {
      previousStackExists = false;
      const stacks = await CF.send(new ListStacksCommand({}));
      if (!stacks.StackSummaries) {
        throw new Error('Faild to get stacks');
      }
      for (let index = 0; index < stacks.StackSummaries.length; index++) {
        const element = stacks.StackSummaries[index];
        if (element.StackName === taskDefStackName && element.StackStatus !== 'DELETE_COMPLETE') {
          previousStackExists = true;
          OrchestratorLogger.log(`Previous stack still exists: ${JSON.stringify(element)}`);
          await new Promise((promise) => setTimeout(promise, 5000));
        }
      }
    }
    const createStackInput: CreateStackCommandInput = {
      StackName: taskDefStackName,
      TemplateBody: taskDefCloudFormation,
      Capabilities: ['CAPABILITY_IAM'],
      Parameters: parameters,
    };
    try {
      const stackWaitTimeSeconds = getStackWaitTime();
      OrchestratorLogger.log(
        `Creating job aws formation ${taskDefStackName} (waiting up to ${stackWaitTimeSeconds}s for completion)`,
      );
      await CF.send(new CreateStackCommand(createStackInput));
      await waitUntilStackCreateComplete(
        {
          client: CF,
          maxWaitTime: stackWaitTimeSeconds,
        },
        { StackName: taskDefStackName },
      );
      const describeStack = await CF.send(new DescribeStacksCommand({ StackName: taskDefStackName }));
      for (const parameter of parameters) {
        if (!describeStack.Stacks?.[0].Parameters?.some((x) => x.ParameterKey === parameter.ParameterKey)) {
          throw new Error(`Parameter ${parameter.ParameterKey} not found in stack`);
        }
      }
    } catch (error) {
      await AWSError.handleStackCreationFailure(error, CF, taskDefStackName);
      throw error;
    }

    const createCleanupStackInput: CreateStackCommandInput = {
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
          ParameterValue: Orchestrator.buildParameters.buildGuid,
        },
        {
          ParameterKey: 'EnvironmentName',
          ParameterValue: this.baseStackName,
        },
      ],
    };
    if (OrchestratorOptions.useCleanupCron) {
      try {
        OrchestratorLogger.log(`Creating job cleanup formation`);
        await CF.send(new CreateStackCommand(createCleanupStackInput));

        // await CF.waitFor('stackCreateComplete', { StackName: createCleanupStackInput.StackName }).promise();
      } catch (error) {
        await AWSError.handleStackCreationFailure(error, CF, taskDefStackName);
        throw error;
      }
    }

    const taskDefResources = (
      await CF.send(
        new DescribeStackResourcesCommand({
          StackName: taskDefStackName,
        }),
      )
    ).StackResources;

    const baseResources = (await CF.send(new DescribeStackResourcesCommand({ StackName: this.baseStackName })))
      .StackResources;

    return {
      taskDefStackName,
      taskDefCloudFormation,
      taskDefResources,
      baseResources,
    };
  }
}
