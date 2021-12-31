import { exec } from 'child_process';
import { RemoteClientLogger } from './remote-client-logger';

export class CloudRunnerAgentSystem {
  public static async Run(command: string) {
    RemoteClientLogger.log(`${command}`);
    return await new Promise<string>((promise) => {
      let output = '';
      const child = exec(command, (error, stdout, stderr) => {
        if (error) {
          RemoteClientLogger.logCliError(`${error.message}`);
          throw new Error(error.toString());
        }
        if (stderr) {
          RemoteClientLogger.logCliDiagnostic(`${stderr.toString()}`);
          return;
        }
        const outputChunk = `${stdout}`;
        output += outputChunk;
      });
      child.on('close', function (code) {
        RemoteClientLogger.log(`[Exit code ${code}]`);
        if (code !== 0) {
          throw new Error(output);
        }
        const outputLines = output.split(`\n`);
        for (const element of outputLines) {
          RemoteClientLogger.log(element);
        }
        promise(output);
      });
    });
  }
}
