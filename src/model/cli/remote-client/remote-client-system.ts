import { exec } from 'child_process';
import CloudRunnerLogger from '../../cloud-runner/services/cloud-runner-logger';

export class RemoteClientSystem {
  public static async Run(command: string) {
    return await new Promise<string>((promise) => {
      let output = '';
      const child = exec(command);
      child.stdout?.on('data', function (data) {
        const outputChunk = `${data}`;
        CloudRunnerLogger.logRemoteCli(outputChunk);
        output += outputChunk;
      });
      child.stderr?.on('data', function (data) {
        CloudRunnerLogger.logRemoteCli(`[STD-ERROR] ${data}`);
      });
      child.on('close', function (code) {
        CloudRunnerLogger.logRemoteCli(`${code} `);
        promise(output);
      });
    });
  }
}
