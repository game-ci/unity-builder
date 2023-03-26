import { CloudRunnerSystem } from '../cloud-runner/services/core/cloud-runner-system';
import * as core from '@actions/core';
import CloudRunnerOptions from '../cloud-runner/options/cloud-runner-options';

export class GithubCliReader {
  static async GetGitHubAuthToken() {
    if (CloudRunnerOptions.providerStrategy === 'local') {
      return '';
    }
    try {
      const authStatus = await CloudRunnerSystem.Run(`gh auth status`, true, true);
      if (authStatus.includes('You are not logged') || authStatus === '') {
        return '';
      }

      return (await CloudRunnerSystem.Run(`gh auth status -t`, false, true))
        .split(`Token: `)[1]
        .replace(/ /g, '')
        .replace(/\n/g, '');
    } catch (error: any) {
      core.info(error || 'Failed to get github auth token from gh cli');

      return '';
    }
  }
}
