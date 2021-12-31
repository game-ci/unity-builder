import CloudRunnerLogger from '../../cloud-runner/services/cloud-runner-logger';
import { CloudRunnerState } from '../../cloud-runner/state/cloud-runner-state';
import { SetupCloudRunnerRepository } from './setup-cloud-runner-repository';

export class RemoteClient {
  static async Run() {
    const buildParameter = JSON.parse(process.env.buildParameters || '{}');
    CloudRunnerLogger.log(`Build Params:
      ${JSON.stringify(buildParameter, undefined, 4)}
    `);
    CloudRunnerState.setup(buildParameter);
    await SetupCloudRunnerRepository.run();
  }
}
