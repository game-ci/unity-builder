import { OrchestratorSystem } from '../orchestrator/services/core/orchestrator-system';
import * as core from '@actions/core';
import OrchestratorOptions from '../orchestrator/options/orchestrator-options';

export class GithubCliReader {
  static async GetGitHubAuthToken() {
    if (OrchestratorOptions.providerStrategy === 'local') {
      return '';
    }
    try {
      const authStatus = await OrchestratorSystem.Run(`gh auth status`, true, true);
      if (authStatus.includes('You are not logged') || authStatus === '') {
        return '';
      }

      return (await OrchestratorSystem.Run(`gh auth status -t`, false, true))
        .split(`Token: `)[1]
        .replace(/ /g, '')
        .replace(/\n/g, '');
    } catch (error: any) {
      core.info(error || 'Failed to get github auth token from gh cli');

      return '';
    }
  }
}
