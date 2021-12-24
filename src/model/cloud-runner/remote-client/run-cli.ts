import { exec } from 'child_process';
import CloudRunnerLogger from '../services/cloud-runner-logger';

export class RunCli {
  public static async RunCli(command: string) {
    return await new Promise<string>((promise) => {
      exec(command, (error, stdout, stderr) => {
        if (error) {
          CloudRunnerLogger.logRemoteCli(`[ERROR] ${error.message}`);
          promise(error.message);
          throw new Error(error.toString());
        }
        if (stderr) {
          CloudRunnerLogger.logRemoteCli(`[STD-ERROR] ${stderr}`);
          promise(stderr);
          throw new Error(stderr.toString());
        }
        CloudRunnerLogger.logRemoteCli(`${stdout}`);
        promise(stdout);
      });
    });
  }
}
