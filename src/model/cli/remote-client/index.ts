import { CloudRunnerState } from '../../cloud-runner/state/cloud-runner-state';
import { RemoteClientLogger } from './remote-client-logger';
import { SetupCloudRunnerRepository } from './setup-cloud-runner-repository';

export class RemoteClient {
  static async Run() {
    const buildParameter = JSON.parse(process.env.BUILD_PARAMETERS || '{}');
    RemoteClientLogger.log(`Build Params:
      ${JSON.stringify(buildParameter, undefined, 4)}
    `);
    CloudRunnerState.setup(buildParameter);
    await SetupCloudRunnerRepository.run();
  }
}
