import { execWithErrorCheck } from './exec-with-error-check';

class MacBuilder {
  public static async run(actionFolder: string, silent: boolean = false): Promise<number> {
    return await execWithErrorCheck('bash', [`${actionFolder}/platforms/mac/entrypoint.sh`], {
      silent,
    });
  }
}

export default MacBuilder;
