import { exec } from 'child_process';
import { RemoteClientLogger } from './remote-client-logger';
export class CloudRunnerSystem {
  public static async Run(command: string, suppressError = false, suppressLogs = false) {
    for (const element of command.split(`\n`)) {
      if (!suppressLogs) {
        RemoteClientLogger.log(element);
      }
    }
    return await new Promise<string>((promise, throwError) => {
      let output = '';
      const child = exec(command, (error, stdout, stderr) => {
        if (!suppressError && error) {
          RemoteClientLogger.log(error.toString());
          throwError(error);
        }
        if (stderr) {
          RemoteClientLogger.log('stderr');
          const diagnosticOutput = `${stderr.toString()}`;
          if (!suppressLogs) {
            RemoteClientLogger.logCliDiagnostic(diagnosticOutput);
          }
          output += diagnosticOutput;
        }
        RemoteClientLogger.log('stdout');
        const outputChunk = `${stdout}`;
        output += outputChunk;
      });
      child.on('message', (message) => {
        RemoteClientLogger.log('message');
        const outputChunk = `${message}`;
        output += outputChunk;
      });
      child.on('error', (error) => {
        RemoteClientLogger.log('error');
        RemoteClientLogger.log(error.toString());
        if (error) {
          throwError(error);
        }
      });
      child.on('disconnect', (error) => {
        RemoteClientLogger.log('disconnect');
        if (error) {
          throwError(error);
        }
      });
      child.on('close', (code) => {
        RemoteClientLogger.log('close');
        if (!suppressLogs) {
          RemoteClientLogger.log(`[Exit code ${code}]`);
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
