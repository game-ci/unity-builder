import { exec } from 'node:child_process';
import Input from '../input';

export class GenericInputReader {
  public static async Run(command: string) {
    if ((Input.getInput('providerStrategy') || 'local') === 'local') {
      return '';
    }

    return new Promise<string>((resolve, reject) => {
      exec(command, { maxBuffer: 1024 * 10000 }, (error, stdout) => {
        if (error) {
          reject(error);

          return;
        }
        resolve(stdout.toString());
      });
    });
  }
}
