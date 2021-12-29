import assert from 'assert';
import System from '../system';

export class GithubCliReader {
  static async GetGitHubAuthToken() {
    try {
      assert(await System.run(`gh --help`, [], {}, false));
      return await System.run(`gh auth status -t`, [], {}, false);
    } catch {
      return '';
    }
  }
}
