import * as SDK from 'aws-sdk';
import CloudRunnerTaskDef from '../services/cloud-runner-task-def';
import CloudRunnerSecret from '../services/cloud-runner-secret';
import CloudRunnerConstants from '../services/cloud-runner-constants';
import { customAlphabet } from 'nanoid';
import { AWSTemplates } from './aws-templates';
import CloudRunnerLogger from '../services/cloud-runner-logger';
import * as fs from 'fs';
import { AWSError } from './aws-error';

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
  ): Promise<CloudRunnerTaskDef> {
    const logGuid = customAlphabet(CloudRunnerConstants.alphabet, 9)();
    commands += `
      echo "${logGuid}"
    `;
    const taskDefStackName = `${this.baseStackName}-${buildGuid}`;
    let taskDefCloudFormation = AWSTemplates.readTaskCloudFormationTemplate();
    const cleanupTaskDefStackName = `${taskDefStackName}-cleanup`;
    const cleanupCloudFormation = fs.readFileSync(`${__dirname}/cloud-formations/cloudformation-stack-ttl.yml`, 'utf8');

    for (const secret of secrets) {
      if (typeof secret.ParameterValue == 'number') {
        secret.ParameterValue = `${secret.ParameterValue}`;
      }
      if (!secret.ParameterValue || secret.ParameterValue === '') {
        secrets = secrets.filter((x) => x !== secret);
        continue;
      }
      taskDefCloudFormation = AWSTemplates.insertAtTemplate(
        taskDefCloudFormation,
        'p1 - input',
        AWSTemplates.getParameterTemplate(secret.ParameterKey.replace(/[^\dA-Za-z]/g, '')),
      );
      taskDefCloudFormation = AWSTemplates.insertAtTemplate(
        taskDefCloudFormation,
        'p2 - secret',
        AWSTemplates.getSecretTemplate(secret.ParameterKey.replace(/[^\dA-Za-z]/g, '')),
      );
      taskDefCloudFormation = AWSTemplates.insertAtTemplate(
        taskDefCloudFormation,
        'p3 - container def',
        AWSTemplates.getSecretDefinitionTemplate(
          secret.EnvironmentVariable,
          secret.ParameterKey.replace(/[^\dA-Za-z]/g, ''),
        ),
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
      {
        ParameterKey: 'BUILDID',
        ParameterValue: buildGuid,
      },
      ...secretsMappedToCloudFormationParameters,
    ];

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

    try {
      await CF.createStack({
        StackName: taskDefStackName,
        TemplateBody: taskDefCloudFormation,
        Capabilities: ['CAPABILITY_IAM'],
        Parameters: parameters,
      }).promise();
      CloudRunnerLogger.log('Creating cloud runner job');
      await CF.createStack({
        StackName: cleanupTaskDefStackName,
        TemplateBody: cleanupCloudFormation,
        Capabilities: ['CAPABILITY_IAM'],
        Parameters: [
          {
            ParameterKey: 'StackName',
            ParameterValue: taskDefStackName,
          },
          {
            ParameterKey: 'DeleteStackName',
            ParameterValue: cleanupTaskDefStackName,
          },
          {
            ParameterKey: 'TTL',
            ParameterValue: '100',
          },
          {
            ParameterKey: 'BUILDID',
            ParameterValue: buildGuid,
          },
          {
            ParameterKey: 'EnvironmentName',
            ParameterValue: this.baseStackName,
          },
        ],
      }).promise();
      await CF.waitFor('stackCreateComplete', { StackName: taskDefStackName }).promise();
    } catch (error) {
      await AWSError.handleStackCreationFailure(
        error,
        CF,
        taskDefStackName,
        //taskDefCloudFormation,
        //parameters,
        //secrets,
      );
      throw error;
    }

    const taskDefResources = (
      await CF.describeStackResources({
        StackName: taskDefStackName,
      }).promise()
    ).StackResources;

    const baseResources = (await CF.describeStackResources({ StackName: this.baseStackName }).promise()).StackResources;

    // TODO: offer a parameter to decide if you want the guaranteed shutdown or fastest startup time possible

    return {
      taskDefStackName,
      taskDefCloudFormation,
      taskDefStackNameTTL: cleanupTaskDefStackName,
      ttlCloudFormation: cleanupCloudFormation,
      taskDefResources,
      baseResources,
      logid: logGuid,
    };
  }
}
