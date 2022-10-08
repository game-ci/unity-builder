import BuildParameters from '../../../build-parameters';
import CloudRunnerEnvironmentVariable from '../../services/cloud-runner-environment-variable';
import CloudRunnerLogger from '../../services/cloud-runner-logger';
import { ProviderInterface } from '../provider-interface';
import CloudRunnerSecret from '../../services/cloud-runner-secret';
import Docker from '../../../docker';
import { Action } from '../../../../model';
import { writeFileSync } from 'fs';
import CloudRunner from '../../cloud-runner';

class LocalDockerCloudRunner implements ProviderInterface {
  public buildParameters: BuildParameters | undefined;

  inspect(): Promise<string> {
    throw new Error('Method not implemented.');
  }
  watch(): Promise<string> {
    throw new Error('Method not implemented.');
  }
  listResources(): Promise<string> {
    throw new Error('Method not implemented.');
  }
  garbageCollect(
    // eslint-disable-next-line no-unused-vars
    filter: string,
    // eslint-disable-next-line no-unused-vars
    previewOnly: boolean,
  ): Promise<string> {
    throw new Error('Method not implemented.');
  }
  cleanup(
    // eslint-disable-next-line no-unused-vars
    buildGuid: string,
    // eslint-disable-next-line no-unused-vars
    buildParameters: BuildParameters,
    // eslint-disable-next-line no-unused-vars
    branchName: string,
    // eslint-disable-next-line no-unused-vars
    defaultSecretsArray: { ParameterKey: string; EnvironmentVariable: string; ParameterValue: string }[],
  ) {}
  setup(
    buildGuid: string,
    buildParameters: BuildParameters,
    // eslint-disable-next-line no-unused-vars
    branchName: string,
    // eslint-disable-next-line no-unused-vars
    defaultSecretsArray: { ParameterKey: string; EnvironmentVariable: string; ParameterValue: string }[],
  ) {
    this.buildParameters = buildParameters;
  }

  public async runTask(
    buildGuid: string,
    image: string,
    commands: string,
    mountdir: string,
    workingdir: string,
    environment: CloudRunnerEnvironmentVariable[],
    secrets: CloudRunnerSecret[],
  ): Promise<string> {
    CloudRunnerLogger.log(buildGuid);
    CloudRunnerLogger.log(commands);

    const { workspace, actionFolder } = Action;
    const content: any[] = [];
    for (const x of secrets) {
      content.push({ name: x.EnvironmentVariable, value: x.ParameterValue });
    }
    for (const x of environment) {
      content.push({ name: x.name, value: x.value });
    }

    // if (this.buildParameters?.cloudRunnerIntegrationTests) {
    //   core.info(JSON.stringify(content, undefined, 4));
    //   core.info(JSON.stringify(secrets, undefined, 4));
    //   core.info(JSON.stringify(environment, undefined, 4));
    // }

    // eslint-disable-next-line unicorn/no-for-loop
    for (let index = 0; index < content.length; index++) {
      if (content[index] === undefined) {
        delete content[index];
      }
    }
    let myOutput = '';
    const sharedFolder = `/data/`;

    // core.info(JSON.stringify({ workspace, actionFolder, ...this.buildParameters, ...content }, undefined, 4));
    const entrypointFilePath = `start.sh`;
    const fileContents = `#!/bin/bash
set -e

apt-get update > /dev/null && apt-get install -y tree> /dev/null
mkdir -p /github/workspace/cloud-runner-cache
mkdir -p /data/cache
cp -a /github/workspace/cloud-runner-cache/. ${sharedFolder}
tree -L 3 ${sharedFolder}
${commands}
cp -a ${sharedFolder}. /github/workspace/cloud-runner-cache/
tree -L 2 /github/workspace/cloud-runner-cache
tree -L 3 ${sharedFolder}
    `;
    writeFileSync(`${workspace}/${entrypointFilePath}`, fileContents, {
      flag: 'w',
    });

    if (CloudRunner.buildParameters.cloudRunnerIntegrationTests) {
      CloudRunnerLogger.log(`Running local-docker: \n ${fileContents}`);
    }

    await Docker.run(
      image,
      { workspace, actionFolder, ...this.buildParameters },
      false,
      `"chmod +x /github/workspace/${entrypointFilePath} && /github/workspace/${entrypointFilePath}"`,
      content,
      {
        listeners: {
          stdout: (data: Buffer) => {
            myOutput += data.toString();
          },
          stderr: (data: Buffer) => {
            myOutput += `[LOCAL-DOCKER-ERROR]${data.toString()}`;
          },
        },
      },
    );

    return myOutput;
  }
}
export default LocalDockerCloudRunner;
