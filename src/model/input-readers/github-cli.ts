import { CloudRunnerSystem } from '../cli/remote-client/remote-client-services/cloud-runner-system';

export class GithubCliReader {
  static async GetGitHubAuthToken() {
    return (await CloudRunnerSystem.Run(`gh auth status -t`)).split(`Token: `)[1].replace(/ /g, '').replace(/\n/g, '');
  }
}
