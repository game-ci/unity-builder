import BuildParameters from '../../../build-parameters.ts';
import { CloudRunnerSystem } from '../../services/cloud-runner-system.ts';
import CloudRunnerEnvironmentVariable from '../../services/cloud-runner-environment-variable.ts';
import CloudRunnerLogger from '../../services/cloud-runner-logger.ts';
import { ProviderInterface } from '../provider-interface.ts';
import CloudRunnerSecret from '../../services/cloud-runner-secret.ts';

class LocalCloudRunner implements ProviderInterface {
  cleanup(
    buildGuid: string,
    buildParameters: BuildParameters,
    branchName: string,
    defaultSecretsArray: { ParameterKey: string; EnvironmentVariable: string; ParameterValue: string }[],
  ) {}
  public setup(
    buildGuid: string,
    buildParameters: BuildParameters,
    branchName: string,
    defaultSecretsArray: { ParameterKey: string; EnvironmentVariable: string; ParameterValue: string }[],
  ) {}
  public async runTask(
    buildGuid: string,
    image: string,
    commands: string,
    mountdir: string,
    workingdir: string,
    environment: CloudRunnerEnvironmentVariable[],
    secrets: CloudRunnerSecret[],
  ): Promise<string> {
    CloudRunnerLogger.log(image);
    CloudRunnerLogger.log(buildGuid);
    CloudRunnerLogger.log(commands);

    return await CloudRunnerSystem.Run(commands);
  }
}
export default LocalCloudRunner;
