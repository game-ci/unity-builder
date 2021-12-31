import System from '../system';

export class GithubCliReader {
  static async GetGitHubAuthToken() {
    try {
      return (await System.run(`gh auth status -t`, [], {}, false))
        .split(`Token: `)[1]
        .replace(/ /g, '')
        .replace(/\n/g, '');
    } catch {
      return '';
    }
  }
}
