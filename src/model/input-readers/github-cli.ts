import { CloudRunnerSystem } from '../cloud-runner/services/cloud-runner-system.ts';
import { core } from '../../dependencies.ts';
import Input from '../input.ts';

export class GithubCliReader {
  static async GetGitHubAuthToken() {
    if (Input.cloudRunnerCluster === 'local') {
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
