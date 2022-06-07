// import { assert } from '../../../node_modules/console';
// import fs from '../../../node_modules/fs';
import { CloudRunnerSystem } from '../cloud-runner/services/cloud-runner-system.ts';
import CloudRunnerLogger from '../cloud-runner/services/cloud-runner-logger.ts';
import Input from '../input.ts';

// Todo - DENO - return assertions
export class GitRepoReader {
  public static async GetRemote() {
    if (Input.cloudRunnerCluster === 'local') {
      return '';
    }
    // assert(fs.existsSync(`.git`));
    const value = (await CloudRunnerSystem.Run(`git remote -v`, false, true)).replace(/ /g, ``);
    CloudRunnerLogger.log(`value ${value}`);
    // assert(value.includes('github.com'));

    return value.split('github.com/')[1].split('.git')[0];
  }

  public static async GetBranch() {
    if (Input.cloudRunnerCluster === 'local') {
      return '';
    }
    // assert(fs.existsSync(`.git`));

    return (await CloudRunnerSystem.Run(`git branch --show-current`, false, true))
      .split('\n')[0]
      .replace(/ /g, ``)
      .replace('/head', '');
  }
}
