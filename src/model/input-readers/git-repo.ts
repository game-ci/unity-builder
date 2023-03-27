import { assert } from 'node:console';
import fs from 'node:fs';
import { CloudRunnerSystem } from '../cloud-runner/services/core/cloud-runner-system';
import CloudRunnerLogger from '../cloud-runner/services/core/cloud-runner-logger';
import CloudRunnerOptions from '../cloud-runner/options/cloud-runner-options';
import Input from '../input';

export class GitRepoReader {
  public static async GetRemote() {
    if (CloudRunnerOptions.providerStrategy === 'local') {
      return '';
    }
    assert(fs.existsSync(`.git`));
    const value = (await CloudRunnerSystem.Run(`cd ${Input.projectPath} && git remote -v`, false, true)).replace(
      / /g,
      ``,
    );
    CloudRunnerLogger.log(`value ${value}`);
    assert(value.includes('github.com'));

    return value.split('github.com')[1].split('.git')[0].slice(1);
  }

  public static async GetBranch() {
    if (CloudRunnerOptions.providerStrategy === 'local') {
      return '';
    }
    assert(fs.existsSync(`.git`));

    return (await CloudRunnerSystem.Run(`cd ${Input.projectPath} && git branch --show-current`, false, true))
      .split('\n')[0]
      .replace(/ /g, ``)
      .replace('/head', '');
  }
}
