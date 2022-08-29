import { Parameters } from './parameters.ts';
import System from './system/system.ts';

class MacBuilder {
  public static async run(actionFolder) {
    log.warning('running the process');
    await System.run(`bash ${actionFolder}/platforms/mac/entrypoint.sh`, {
      ignoreReturnCode: true,
    });
  }
}

export default MacBuilder;
