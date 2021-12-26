import { exec } from 'child_process';
import CloudRunnerLogger from '../../cloud-runner/services/cloud-runner-logger';

export class RemoteClientSystem {
  public static async Run(command: string) {
    return await new Promise<string>((promise) => {
      let output = '';
      const child = exec(command, (error, stdout, stderr) => {
        if (error) {
          CloudRunnerLogger.logRemoteCli(`[ERROR] ${error.message}`);
          throw new Error(error.toString());
        }
        if (stderr) {
          CloudRunnerLogger.logRemoteCli(`[DIAGNOSTIC] ${stderr.toString()}`);
          return;
        }
        const outputChunk = `${stdout.toString()}`;
        CloudRunnerLogger.logRemoteCli(outputChunk);
        output += outputChunk;
      });
      child.on('close', function (code) {
        if (code !== 0) {
          throw new Error(`[exit code ${code}] Output Ended`);
        }
        CloudRunnerLogger.logRemoteCli(`[exit code 0] Output Ended`);
        promise(output);
      });
    });
  }
}
