import CloudRunnerLogger from '../services/cloud-runner-logger';
import * as core from '@actions/core';
import CloudRunner from '../cloud-runner';

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
