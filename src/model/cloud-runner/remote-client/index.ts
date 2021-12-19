import { CloudRunnerState } from '../state/cloud-runner-state';
import { DownloadRepository } from './remote-steps/download-repository';

export class RemoteClientCli {
  static async RunRemoteClient(options) {
    const buff = Buffer.from(process.env.SERIALIZED_BUILD_PARAMS || '', 'base64');
    const text = buff.toString('ascii');
    CloudRunnerState.setup(JSON.parse(text));
    switch (options.remoteClientState) {
      default:
        await DownloadRepository.run();
        break;
    }
  }
}
