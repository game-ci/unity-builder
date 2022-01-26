import { exec } from '@actions/exec';
import { BuildParameters } from '.';

class MacBuilder {
  public static async run(actionFolder, workspace, buildParameters: BuildParameters, silent = false) {
    const command = `source ${actionFolder}/platforms/mac/entrypoint.sh`;
    await exec(command, undefined, { silent });
  }
}

export default MacBuilder;
