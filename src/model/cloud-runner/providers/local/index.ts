import BuildParameters from '../../../build-parameters.ts';
import { CloudRunnerSystem } from '../../services/cloud-runner-system.ts';
import CloudRunnerEnvironmentVariable from '../../services/cloud-runner-environment-variable.ts';
import CloudRunnerLogger from '../../services/cloud-runner-logger.ts';
import { ProviderInterface } from '../provider-interface.ts';
import CloudRunnerSecret from '../../services/cloud-runner-secret.ts';

class LocalCloudRunner implements ProviderInterface {
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
  public setup(
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
    buildGuid: string,
    image: string,
    commands: string,
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

    return await CloudRunnerSystem.Run(commands);
  }
}
export default LocalCloudRunner;
