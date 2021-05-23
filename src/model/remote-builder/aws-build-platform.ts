import * as SDK from 'aws-sdk';
import { customAlphabet } from 'nanoid';
import RemoteBuilderSecret from './remote-builder-secret';
import RemoteBuilderEnvironmentVariable from './remote-builder-environment-variable';
import * as fs from 'fs';
import * as core from '@actions/core';
import RemoteBuilderTaskDef from './remote-builder-task-def';
import RemoteBuilderConstants from './remote-builder-constants';
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

  // static async setupPlatformResources() {
  //   throw new Error('Method not implemented.');
  // }

  static getParameterTemplate(p1) {
    return `
  ${p1}:
    Type: String
    Default: ''
`;
  }

  static getSecretTemplate(p1) {
    return `
  ${p1}Secret:
    Type: AWS::SecretsManager::Secret
    Properties:
      Name: !Join [ "", [ '${p1}', !Ref BUILDID ] ]
      SecretString: !Ref ${p1}
`;
  }

  static getSecretDefinitionTemplate(p1, p2) {
    return `
            - Name: '${p1}'
              ValueFrom: !Ref ${p2}Secret
`;
  }

  static insertAtTemplate(template, insertionKey, insertion) {
    const index = template.search(insertionKey) + insertionKey.length + '\n'.length;
    template = [template.slice(0, index), insertion, template.slice(index)].join('');
    return template;
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
    const logid = customAlphabet(RemoteBuilderConstants.alphabet, 9)();
    commands[1] += `
      echo "${logid}"
    `;
    const taskDefStackName = `${stackName}-${buildUid}`;
    let taskDefCloudFormation = this.readTaskCloudFormationTemplate();
    const cleanupTaskDefStackName = `${taskDefStackName}-cleanup`;
    const cleanupCloudFormation = fs.readFileSync(`${__dirname}/cloud-formations/cloudformation-stack-ttl.yml`, 'utf8');

    try {
      for (const secret of secrets) {
        taskDefCloudFormation = this.insertAtTemplate(
          taskDefCloudFormation,
          'p1 - input',
          this.getParameterTemplate(secret.ParameterKey.replace(/[^\dA-Za-z]/g, '')),
        );
        taskDefCloudFormation = this.insertAtTemplate(
          taskDefCloudFormation,
          'p2 - secret',
          this.getSecretTemplate(secret.ParameterKey.replace(/[^\dA-Za-z]/g, '')),
        );
        taskDefCloudFormation = this.insertAtTemplate(
          taskDefCloudFormation,
          'p3 - container def',
          this.getSecretDefinitionTemplate(secret.EnvironmentVariable, secret.ParameterKey.replace(/[^\dA-Za-z]/g, '')),
        );
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

      await CF.waitFor('stackCreateComplete', { StackName: taskDefStackName }).promise();
    } catch (error) {
      await AWSBuildEnvironment.handleStackCreationFailure(error, CF, taskDefStackName, taskDefCloudFormation, secrets);

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

  private static async handleStackCreationFailure(
    error: any,
    CF: SDK.CloudFormation,
    taskDefStackName: string,
    taskDefCloudFormation: string,
    secrets: RemoteBuilderSecret[],
  ) {
    core.info(JSON.stringify(secrets, undefined, 4));
    core.info(taskDefCloudFormation);
    const events = (await CF.describeStackEvents({ StackName: taskDefStackName }).promise()).StackEvents;
    const resources = (await CF.describeStackResources({ StackName: taskDefStackName }).promise()).StackResources;
    core.info(JSON.stringify(events, undefined, 4));
    core.info(JSON.stringify(resources, undefined, 4));
    core.error(error);
  }

  static readTaskCloudFormationTemplate(): string {
    return fs.readFileSync(`${__dirname}/cloud-formations/task-def-formation.yml`, 'utf8');
  }

  static async cleanupResources(CF: SDK.CloudFormation, taskDef: RemoteBuilderTaskDef) {
    core.info('Cleanup starting');
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
