import { exec } from '@actions/exec';

class MacBuilder {
  public static async run(actionFolder: string, silent: boolean = false): Promise<number> {
    return await exec('bash', [`${actionFolder}/platforms/mac/entrypoint.sh`], {
      silent,
      ignoreReturnCode: true,
    });
  }
}

export default MacBuilder;
