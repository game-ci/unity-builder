import { execWithErrorCheck } from './exec-with-error-check';

class MacBuilder {
  public static async run(actionFolder, silent = false) {
    await execWithErrorCheck('bash', [`${actionFolder}/platforms/mac/entrypoint.sh`], {
      silent,
    });
  }
}

export default MacBuilder;
