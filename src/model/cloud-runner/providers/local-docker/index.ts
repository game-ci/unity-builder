import Parameters from '../../../parameters.ts';
import { CloudRunnerSystem } from '../../services/cloud-runner-system.ts';
import CloudRunnerEnvironmentVariable from '../../services/cloud-runner-environment-variable.ts';
import CloudRunnerLogger from '../../services/cloud-runner-logger.ts';
import { ProviderInterface } from '../provider-interface.ts';
import CloudRunnerSecret from '../../services/cloud-runner-secret.ts';

class LocalDockerCloudRunner implements ProviderInterface {
  cleanup(
    buildGuid: string,
    buildParameters: Parameters,
    branchName: string,
    defaultSecretsArray: { ParameterKey: string; EnvironmentVariable: string; ParameterValue: string }[],
  ) {}
  setup(
    buildGuid: string,
    buildParameters: Parameters,
    branchName: string,
    defaultSecretsArray: { ParameterKey: string; EnvironmentVariable: string; ParameterValue: string }[],
  ) {}
  public runTask(
    commands: string,
    buildGuid: string,
    image: string,
    mountdir: string,
    workingdir: string,
    environment: CloudRunnerEnvironmentVariable[],
    secrets: CloudRunnerSecret[],
  ): Promise<string> {
    CloudRunnerLogger.log(buildGuid);
    CloudRunnerLogger.log(commands);

    return CloudRunnerSystem.Run(commands, false, false);
  }
}
export default LocalDockerCloudRunner;
