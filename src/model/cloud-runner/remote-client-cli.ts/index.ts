import { DownloadRepository } from '../steps/remote-steps.ts/download-repository';

export class RemoteClientCli {
  static async RunRemoteClient(options) {
    switch (options.remoteClientState) {
      default:
        await DownloadRepository.run();
        break;
    }
  }
}
