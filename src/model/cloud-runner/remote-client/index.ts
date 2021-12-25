import { CloudRunnerState } from '../state/cloud-runner-state';
import { DownloadRepository } from './remote-steps/setup-repo';

export class RemoteClientCli {
  static async RunRemoteClient(options) {
    const buildParameter = JSON.parse(process.env.buildParameters || '{}');
    CloudRunnerState.setup(buildParameter);
    switch (options.remoteClientState) {
      default:
        await DownloadRepository.run();
        break;
    }
  }
}
