import { exec } from 'child_process';
import { RemoteClientLogger } from '../../remote-client/remote-client-logger';

export class CloudRunnerSystem {
  public static async RunAndReadLines(command: string): Promise<string[]> {
    const result = await CloudRunnerSystem.Run(command, false, true);

    return result
      .split(`\n`)
      .map((x) => x.replace(`\r`, ``))
      .filter((x) => x !== ``)
      .map((x) => {
        const lineValues = x.split(` `);

        return lineValues[lineValues.length - 1];
      });
  }

  public static async Run(
    command: string,
    suppressError = false,
    suppressLogs = false,
    // eslint-disable-next-line no-unused-vars
    outputCallback?: (output: string) => void,
  ) {
    for (const element of command.split(`\n`)) {
      if (!suppressLogs) {
        RemoteClientLogger.log(element);
      }
    }

    return await new Promise<string>((promise, throwError) => {
      let output = '';
      const child = exec(command, { maxBuffer: 1024 * 10000 }, (error, stdout, stderr) => {
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
        if (outputCallback) {
          outputCallback(outputChunk);
        }
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
