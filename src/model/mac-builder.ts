import { exec } from '../../../node_modules/@actions/exec';
import { BuildParameters } from './build-parameters.ts';

class MacBuilder {
  public static async run(actionFolder, workspace, buildParameters: BuildParameters, silent = false) {
    await exec('bash', [`${actionFolder}/platforms/mac/entrypoint.sh`], {
      silent,
      ignoreReturnCode: true,
    });
  }
}

export default MacBuilder;
