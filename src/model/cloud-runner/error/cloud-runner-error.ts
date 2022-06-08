import CloudRunnerLogger from '../services/cloud-runner-logger.ts';
import { core } from '../../../dependencies.ts';
import CloudRunner from '../cloud-runner.ts';

export class CloudRunnerError {
  public static async handleException(error: unknown) {
    CloudRunnerLogger.error(JSON.stringify(error, undefined, 4));
    core.setFailed('Cloud Runner failed');
    await CloudRunner.Provider.cleanup(
      CloudRunner.buildParameters.buildGuid,
      CloudRunner.buildParameters,
      CloudRunner.buildParameters.branch,
      CloudRunner.defaultSecrets,
    );
  }
}
