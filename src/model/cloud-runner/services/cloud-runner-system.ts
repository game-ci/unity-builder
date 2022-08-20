import { RemoteClientLogger } from '../remote-client/remote-client-logger.ts';
import { spawn } from 'https://deno.land/std@0.152.0/node/child_process.ts';

export class CloudRunnerSystem {
  public static async Run(command: string, suppressError = false, suppressLogs = false) {
    for (const element of command.split(`\n`)) {
      if (!suppressLogs) {
        RemoteClientLogger.log(element);
      }
    }

    return await new Promise<string>((promise, throwError) => {
      let output = '';

      // Todo - find Deno variant of child_process or rewrite this method to use execSync
      const child = spawn(command, (error, stdout, stderr) => {
        if (!suppressError && error) {
          RemoteClientLogger.log(error.toString());
          throwError(error);
        }
        if (stderr) {
          const diagnosticOutput = `${stderr.toString()}`;
          if (!suppressLogs) {
            RemoteClientLogger.logCliDiagnostic(diagnosticOutput);
          }
          output += diagnosticOutput;
        }
        const outputChunk = `${stdout}`;
        output += outputChunk;
      });
      child.on('close', (code) => {
        if (!suppressLogs) {
          RemoteClientLogger.log(`[${code}]`);
        }
        if (code !== 0 && !suppressError) {
          throwError(output);
        }
        const outputLines = output.split(`\n`);
        for (const element of outputLines) {
          if (!suppressLogs) {
            RemoteClientLogger.log(element);
          }
        }
        promise(output);
      });
    });
  }
}
