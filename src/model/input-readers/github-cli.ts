import { CloudRunnerSystem } from '../cloud-runner/services/cloud-runner-system';
import * as core from '@actions/core';

export class GithubCliReader {
  static async GetGitHubAuthToken() {
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
