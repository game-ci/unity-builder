import CloudRunnerLogger from '../services/core/cloud-runner-logger';
import * as core from '@actions/core';
import CloudRunner from '../cloud-runner';
import CloudRunnerSecret from '../options/cloud-runner-secret';
import BuildParameters from '../../build-parameters';

export class CloudRunnerError {
  public static async handleException(error: unknown, buildParameters: BuildParameters, secrets: CloudRunnerSecret[]) {
    CloudRunnerLogger.error(JSON.stringify(error, undefined, 4));
    core.setFailed('Cloud Runner failed');
    if (CloudRunner.Provider !== undefined) {
      await CloudRunner.Provider.cleanupWorkflow(buildParameters, buildParameters.branch, secrets);
    }
  }
}
