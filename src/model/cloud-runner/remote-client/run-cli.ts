import { exec } from 'child_process';

export class RunCli {
  public static async RunCli(command: string) {
    return await new Promise<string>((promise) => {
      exec(command, (error, stdout, stderr) => {
        if (error) {
          // eslint-disable-next-line no-console
          console.log(`[Remote-CLI][ERROR] ${error.message}`);
          promise(error.message);
          return;
        }
        if (stderr) {
          // eslint-disable-next-line no-console
          console.log(`[Remote-CLI][STD-ERROR] ${stderr}`);
          promise(stderr);
          return;
        }
        // eslint-disable-next-line no-console
        console.log(`[Remote-CLI] ${stdout}`);
        promise(stdout);
      });
    });
  }
}
