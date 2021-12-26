import { exec } from 'child_process';
import CloudRunnerLogger from '../../cloud-runner/services/cloud-runner-logger';

export class RemoteClientSystem {
  public static async Run(command: string) {
    return await new Promise<string>((promise) => {
      let output = '';
      const child = exec(command, (error, stdout, stderr) => {
        if (error) {
          CloudRunnerLogger.logCli(`[ERROR] ${error.message}`);
          throw new Error(error.toString());
        }
        if (stderr) {
          CloudRunnerLogger.logCli(`[DIAGNOSTIC] ${stderr.toString()}`);
          return;
        }
        const outputChunk = `${stdout.toString()}`;
        const outputLines = outputChunk.split(`\n`);
        for (const element of outputLines) {
          CloudRunnerLogger.logCli(element);
        }
        output += outputChunk;
      });
      child.on('close', function (code) {
        CloudRunnerLogger.logCli(`[Exit code ${code}]`);
        if (code !== 0) {
          throw new Error(output);
        }
        promise(output);
      });
    });
  }
}
