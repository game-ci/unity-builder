import { BuildParameters } from '../..';
import { CloudRunnerState } from '../state/cloud-runner-state';
import { DownloadRepository } from './remote-steps/download-repository';

export class RemoteClientCli {
  static async RunRemoteClient(options) {
    const buildParameter = await BuildParameters.create();
    CloudRunnerState.setup(buildParameter);
    switch (options.remoteClientState) {
      default:
        await DownloadRepository.run();
        break;
    }
  }
}
