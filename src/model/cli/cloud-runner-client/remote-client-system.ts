import { exec } from 'child_process';
import CloudRunnerLogger from '../../cloud-runner/services/cloud-runner-logger';

export class RemoteClientSystem {
  public static async Run(command: string) {
    return await new Promise<string>((promise) => {
      exec(command, (error, stdout, stderr) => {
        if (error) {
          CloudRunnerLogger.logRemoteCli(`[ERROR] ${error.message}`);
          throw new Error(error.toString());
        }
        if (stderr) {
          CloudRunnerLogger.logRemoteCli(`[STD-ERROR] ${stderr.toString()}`);
          throw new Error(stderr.toString());
        }
        CloudRunnerLogger.logRemoteCli(`${stdout.toString()}`);
        promise(stdout.toString());
      });
    });
  }
}
