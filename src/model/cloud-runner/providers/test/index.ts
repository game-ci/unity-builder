import BuildParameters from '../../../build-parameters';
import CloudRunnerEnvironmentVariable from '../../services/cloud-runner-environment-variable';
import CloudRunnerLogger from '../../services/cloud-runner-logger';
import { ProviderInterface } from '../provider-interface';
import CloudRunnerSecret from '../../services/cloud-runner-secret';

class TestCloudRunner implements ProviderInterface {
  inspect(): Promise<string> {
    throw new Error('Method not implemented.');
  }
  watch(): Promise<string> {
    throw new Error('Method not implemented.');
  }
  listAll(): Promise<string> {
    throw new Error('Method not implemented.');
  }
  listTasks(): Promise<string> {
    throw new Error('Method not implemented.');
  }
  listOtherResources(): Promise<string> {
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
    // eslint-disable-next-line no-unused-vars
    buildGuid: string,
    // eslint-disable-next-line no-unused-vars
    buildParameters: BuildParameters,
    // eslint-disable-next-line no-unused-vars
    branchName: string,
    // eslint-disable-next-line no-unused-vars
    defaultSecretsArray: { ParameterKey: string; EnvironmentVariable: string; ParameterValue: string }[],
  ) {}
  public async runTask(
    commands: string,
    buildGuid: string,
    image: string,
    // eslint-disable-next-line no-unused-vars
    mountdir: string,
    // eslint-disable-next-line no-unused-vars
    workingdir: string,
    // eslint-disable-next-line no-unused-vars
    environment: CloudRunnerEnvironmentVariable[],
    // eslint-disable-next-line no-unused-vars
    secrets: CloudRunnerSecret[],
  ): Promise<string> {
    CloudRunnerLogger.log(image);
    CloudRunnerLogger.log(buildGuid);
    CloudRunnerLogger.log(commands);

    return await new Promise((result) => {
      result(commands);
    });
  }
}
export default TestCloudRunner;
