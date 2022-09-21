import BuildParameters from '../../../build-parameters';
import CloudRunnerEnvironmentVariable from '../../services/cloud-runner-environment-variable';
import CloudRunnerLogger from '../../services/cloud-runner-logger';
import { ProviderInterface } from '../provider-interface';
import CloudRunnerSecret from '../../services/cloud-runner-secret';
import Docker from '../../../docker';
import { Action } from '../../../../model';

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
    let myOutput = '';
    const content = [
      ...secrets.map((x) => {
        secrets[x.EnvironmentVariable] = x.ParameterValue;

        return;
      }),
      ...environment.map((x) => {
        environment[x.name] = x.value;

        return;
      }),
    ];

    // core.info(JSON.stringify({ workspace, actionFolder, ...this.buildParameters, ...content }, undefined, 4));
    await Docker.run(image, { workspace, actionFolder, ...this.buildParameters, ...content }, false, commands, {
      listeners: {
        stdout: (data: Buffer) => {
          myOutput += data.toString();
        },
        stderr: (data: Buffer) => {
          myOutput += `[LOCAL-DOCKER-ERROR]${data.toString()}`;
        },
      },
    });

    return myOutput;
  }
}
export default LocalDockerCloudRunner;
