import CloudRunnerLogger from '../../cloud-runner/services/cloud-runner-logger';
import System from '../../system';

export class RemoteClientSystem {
  public static async Run(command: string) {
    try {
      const result = await System.run(command);
      CloudRunnerLogger.logRemoteCli(`${result}`);
      return result;
    } catch (error) {
      CloudRunnerLogger.logRemoteCli(`[ERROR] (${command}) ${error}`);
      throw error;
    }
  }
}
