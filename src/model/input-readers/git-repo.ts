import { assert } from 'console';
import System from '../system';
import fs from 'fs';

export class GitRepoReader {
  static GetSha() {
    return '';
  }
  public static async GetRemote() {
    return (await System.run(`git remote -v`, [], {}, false))
      .split(' ')[1]
      .split('https://github.com/')[1]
      .split('.git')[0];
  }
  public static async GetBranch() {
    assert(fs.existsSync(`.git`));
    return (await System.run(`git branch`, [], {}, false)).split('*')[1].split(`\n`)[0].replace(/ /g, ``);
  }
}
