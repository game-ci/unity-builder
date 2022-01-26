import { exec } from '@actions/exec';
import { BuildParameters } from '.';

class MacBuilder {
  public static async run(actionFolder, workspace, buildParameters: BuildParameters, silent = false) {
    await exec('bash', [`${actionFolder}/platforms/mac/entrypoint.sh`], {
      silent,
      cwd: `${actionFolder}/platforms/mac`,
      ignoreReturnCode: true,
    });
  }
}

export default MacBuilder;
