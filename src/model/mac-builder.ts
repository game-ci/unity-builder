import { exec } from '@actions/exec';
import { BuildParameters } from '.';

class MacBuilder {
  public static async run(actionFolder, workspace, buildParameters: BuildParameters, silent = false) {
    const command = `bash`;
    await exec(command, [`-x`, `${actionFolder}/platforms/mac/entrypoint.sh`], { silent });
  }
}

export default MacBuilder;
