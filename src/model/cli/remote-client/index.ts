import { CloudRunnerState } from '../../cloud-runner/state/cloud-runner-state';
import { SetupRemoteRepository } from './setup-remote-repository';

export class RemoteClient {
  static async Run(options) {
    const buildParameter = JSON.parse(process.env.buildParameters || '{}');
    CloudRunnerState.setup(buildParameter);
    switch (options.remoteClientState) {
      default:
        await SetupRemoteRepository.run();
        break;
    }
  }
}
