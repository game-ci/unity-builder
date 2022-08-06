import BuildParameters from '../../../build-parameters.ts';
import CloudRunnerEnvironmentVariable from '../../services/cloud-runner-environment-variable.ts';
import CloudRunnerLogger from '../../services/cloud-runner-logger.ts';
import { ProviderInterface } from '../provider-interface.ts';
import CloudRunnerSecret from '../../services/cloud-runner-secret.ts';

class TestCloudRunner implements ProviderInterface {
  cleanup(
    buildGuid: string,
    buildParameters: BuildParameters,
    branchName: string,
    defaultSecretsArray: { ParameterKey: string; EnvironmentVariable: string; ParameterValue: string }[],
  ) {}
  setup(
    buildGuid: string,
    buildParameters: BuildParameters,
    branchName: string,
    defaultSecretsArray: { ParameterKey: string; EnvironmentVariable: string; ParameterValue: string }[],
  ) {}
  public async runTask(
    commands: string,
    buildGuid: string,
    image: string,
    mountdir: string,
    workingdir: string,
    environment: CloudRunnerEnvironmentVariable[],
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
