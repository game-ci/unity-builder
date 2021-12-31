import { CloudRunnerState } from '../../cloud-runner/state/cloud-runner-state';
import { SetupCloudRunnerRepository } from './setup-cloud-runner-repository';

export class RemoteClient {
  static async Run() {
    const buildParameter = JSON.parse(process.env.buildParameters || '{}');
    CloudRunnerState.setup(buildParameter);
    await SetupCloudRunnerRepository.run();
  }
}
