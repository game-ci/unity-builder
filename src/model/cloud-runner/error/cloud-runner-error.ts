import CloudRunnerLogger from '../services/cloud-runner-logger';
import { CloudRunnerState } from '../state/cloud-runner-state';
import * as core from '@actions/core';

export class CloudRunnerError {
  public static async handleException(error: unknown) {
    CloudRunnerLogger.error(JSON.stringify(error, undefined, 4));
    core.setFailed('Cloud Runner failed');
    await CloudRunnerState.CloudRunnerProviderPlatform.cleanupSharedResources(
      CloudRunnerState.buildGuid,
      CloudRunnerState.buildParams,
      CloudRunnerState.branchName,
      CloudRunnerState.defaultSecrets,
    );
  }
}
