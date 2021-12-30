import { CloudRunnerState } from '../../cloud-runner/state/cloud-runner-state';
import { CloudRunnerRepositorySetup } from './cloud-runner-repository-setup';

export class RemoteClient {
  static async Run() {
    const buildParameter = JSON.parse(process.env.buildParameters || '{}');
    CloudRunnerState.setup(buildParameter);
    await CloudRunnerRepositorySetup.run();
  }
}
