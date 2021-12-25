import { CloudRunnerState } from '../../cloud-runner/state/cloud-runner-state';
import { DownloadRepository } from './setup-repo';

export class RemoteClient {
  static async Run(options) {
    const buildParameter = JSON.parse(process.env.buildParameters || '{}');
    CloudRunnerState.setup(buildParameter);
    switch (options.remoteClientState) {
      default:
        await DownloadRepository.run();
        break;
    }
  }
}
