import { DownloadRepository } from '../steps/remote-steps/download-repository';

export class RemoteClientCli {
  static async RunRemoteClient(options) {
    switch (options.remoteClientState) {
      default:
        await DownloadRepository.run();
        break;
    }
  }
}
