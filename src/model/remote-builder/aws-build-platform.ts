import * as SDK from 'aws-sdk';
import { customAlphabet } from 'nanoid';
import RemoteBuilderSecret from './remote-builder-secret';
import RemoteBuilderEnvironmentVariable from './remote-builder-environment-variable';
import * as fs from 'fs';
import * as core from '@actions/core';
import RemoteBuilderTaskDef from './remote-builder-task-def';
import RemoteBuilderAlphabet from './remote-builder-alphabet';
import AWSBuildRunner from './aws-build-runner';

class AWSBuildEnvironment {
  static async runBuild(
    buildId: string,
    stackName: string,
    image: string,
    commands: string[],
    mountdir: string,
    workingdir: string,
    environment: RemoteBuilderEnvironmentVariable[],
    secrets: RemoteBuilderSecret[],
  ) {
    const ECS = new SDK.ECS();
    const CF = new SDK.CloudFormation();
    const entrypoint = ['/bin/sh'];

    const taskDef = await this.setupCloudFormations(
      CF,
      buildId,
      stackName,
      image,
      entrypoint,
      commands,
      mountdir,
      workingdir,
      secrets,
    );
    try {
      await AWSBuildRunner.runTask(taskDef, ECS, CF, environment, buildId);
    } finally {
      await this.cleanupResources(CF, taskDef);
    }
  }

  static async setupCloudFormations(
    CF: SDK.CloudFormation,
    buildUid: string,
    stackName: string,
    image: string,
    entrypoint: string[],
    commands: string[],
    mountdir: string,
    workingdir: string,
    secrets: RemoteBuilderSecret[],
  ): Promise<RemoteBuilderTaskDef> {
    const logid = customAlphabet(RemoteBuilderAlphabet.alphabet, 9)();
    commands[1] += `
      echo "${logid}"
    `;
    const taskDefStackName = `${stackName}-${buildUid}`;
    let taskDefCloudFormation = this.readTaskCloudFormationTemplate();

    // Debug secrets
    // core.info(JSON.stringify(secrets, undefined, 4));

    for (const secret of secrets) {
      const insertionStringParameters = 'p1 - input';
      const insertionStringSecrets = 'p2 - secret';
      const insertionStringContainerSecrets = 'p3 - container def';
      const indexp1 =
        taskDefCloudFormation.search(insertionStringParameters) + insertionStringParameters.length + '\n'.length;
      const parameterTemplate = `
  ${secret.ParameterKey.replace(/[^\dA-Za-z]/g, '')}:
    Type: String
    Default: ''
`;
      taskDefCloudFormation = [
        taskDefCloudFormation.slice(0, indexp1),
        parameterTemplate,
        taskDefCloudFormation.slice(indexp1),
      ].join('');
      const indexp2 =
        taskDefCloudFormation.search(insertionStringSecrets) + insertionStringSecrets.length + '\n'.length;
      const secretTemplate = `
  ${secret.ParameterKey.replace(/[^\dA-Za-z]/g, '')}Secret:
    Type: AWS::SecretsManager::Secret
    Properties: 
      Name: !Join [ "", [ '${secret.ParameterKey.replace(/[^\dA-Za-z]/g, '')}', !Ref BUILDID ] ]
      SecretString: !Ref ${secret.ParameterKey.replace(/[^\dA-Za-z]/g, '')}
`;
      taskDefCloudFormation = [
        taskDefCloudFormation.slice(0, indexp2),
        secretTemplate,
        taskDefCloudFormation.slice(indexp2),
      ].join('');
      const indexp3 =
        taskDefCloudFormation.search(insertionStringContainerSecrets) + insertionStringContainerSecrets.length;
      const containerDefinitionSecretTemplate = `
            - Name: '${
              secret.EnvironmentVariable.replace(/[^\dA-Za-z]/g, '')
                ? secret.EnvironmentVariable.replace(/[^\dA-Za-z]/g, '')
                : secret.ParameterKey.replace(/[^\dA-Za-z]/g, '')
            }'
              ValueFrom: !Ref ${secret.ParameterKey.replace(/[^\dA-Za-z]/g, '')}Secret`;
      taskDefCloudFormation = [
        taskDefCloudFormation.slice(0, indexp3),
        containerDefinitionSecretTemplate,
        taskDefCloudFormation.slice(indexp3),
      ].join('');
    }
    const mappedSecrets = secrets.map((x) => {
      return { ParameterKey: x.ParameterKey.replace(/[^\dA-Za-z]/g, ''), ParameterValue: x.ParameterValue };
    });
    await CF.createStack({
      StackName: taskDefStackName,
      TemplateBody: taskDefCloudFormation,
      Parameters: [
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
          ParameterValue: commands.join(','),
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
          ParameterValue: buildUid,
        },
        ...mappedSecrets,
      ],
    }).promise();
    core.info('Creating worker cluster...');

    const cleanupTaskDefStackName = `${taskDefStackName}-cleanup`;
    const cleanupCloudFormation = fs.readFileSync(`${__dirname}/cloud-formations/cloudformation-stack-ttl.yml`, 'utf8');
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
          ParameterValue: buildUid,
        },
      ],
    }).promise();
    core.info('Creating cleanup cluster...');

    try {
      await CF.waitFor('stackCreateComplete', { StackName: taskDefStackName }).promise();
    } catch (error) {
      core.error(error);

      const events = (await CF.describeStackEvents({ StackName: taskDefStackName }).promise()).StackEvents;
      const resources = (await CF.describeStackResources({ StackName: taskDefStackName }).promise()).StackResources;

      core.info(taskDefCloudFormation);
      core.info(JSON.stringify(events, undefined, 4));
      core.info(JSON.stringify(resources, undefined, 4));

      throw error;
    }

    const taskDefResources = (
      await CF.describeStackResources({
        StackName: taskDefStackName,
      }).promise()
    ).StackResources;

    const baseResources = (await CF.describeStackResources({ StackName: stackName }).promise()).StackResources;

    // in the future we should offer a parameter to choose if you want the guarnteed shutdown.
    core.info('Worker cluster created successfully (skipping wait for cleanup cluster to be ready)');

    return {
      taskDefStackName,
      taskDefCloudFormation,
      taskDefStackNameTTL: cleanupTaskDefStackName,
      ttlCloudFormation: cleanupCloudFormation,
      taskDefResources,
      baseResources,
      logid,
    };
  }

  static readTaskCloudFormationTemplate(): string {
    return fs.readFileSync(`${__dirname}/cloud-formations/task-def-formation.yml`, 'utf8');
  }

  static async cleanupResources(CF: SDK.CloudFormation, taskDef: RemoteBuilderTaskDef) {
    await CF.deleteStack({
      StackName: taskDef.taskDefStackName,
    }).promise();

    await CF.deleteStack({
      StackName: taskDef.taskDefStackNameTTL,
    }).promise();

    await CF.waitFor('stackDeleteComplete', {
      StackName: taskDef.taskDefStackName,
    }).promise();

    // Currently too slow and causes too much waiting
    await CF.waitFor('stackDeleteComplete', {
      StackName: taskDef.taskDefStackNameTTL,
    }).promise();

    core.info('Cleanup complete');
  }
}
export default AWSBuildEnvironment;
