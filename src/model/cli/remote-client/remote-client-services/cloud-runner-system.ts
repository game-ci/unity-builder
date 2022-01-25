import { exec } from 'child_process';
import { RemoteClientLogger } from './remote-client-logger';

export class CloudRunnerSystem {
  public static async Run(command: string) {
    for (const element of command.split(`\n`)) {
      RemoteClientLogger.log(element);
    }
    return await new Promise<string>((promise) => {
      let output = '';
      const child = exec(command, (error, stdout, stderr) => {
        if (error) {
          throw error;
        }
        if (stderr) {
          const diagnosticOutput = `${stderr.toString()}`;
          RemoteClientLogger.logCliDiagnostic(diagnosticOutput);
          output += diagnosticOutput;
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
