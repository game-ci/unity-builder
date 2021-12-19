const { exec } = require('child_process');

export class DownloadRepository {
  public static async run() {
    await new Promise<void>((promise) => {
      exec(
        `
      echo "test"
      apk update -q
      apk add unzip zip git-lfs jq tree -q
      `,
        (error, stdout, stderr) => {
          if (error) {
            // eslint-disable-next-line no-console
            console.log(`error: ${error.message}`);
            promise();
            return;
          }
          if (stderr) {
            // eslint-disable-next-line no-console
            console.log(`stderr: ${stderr}`);
            promise();
            return;
          }
          // eslint-disable-next-line no-console
          console.log(`stdout: ${stdout}`);
          promise();
        },
      );
    });
  }
}
