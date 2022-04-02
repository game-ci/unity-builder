import { assert } from 'console';
import System from '../system';
import fs from 'fs';
import { CloudRunnerSystem } from '../cli/remote-client/remote-client-services/cloud-runner-system';

export class GitRepoReader {
  public static async GetRemote() {
    return (await CloudRunnerSystem.Run(`git remote -v`, false, true))
      .split(' ')[1]
      .split('https://github.com/')[1]
      .split('.git')[0];
  }
  public static async GetBranch() {
    assert(fs.existsSync(`.git`));
    return (await System.run(`git branch`, [], {}, false)).split('*')[1].split(`\n`)[0].replace(/ /g, ``);
  }
}
