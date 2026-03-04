import { assert } from 'node:console';
import fs from 'node:fs';
import { OrchestratorSystem } from '../orchestrator/services/core/orchestrator-system';
import OrchestratorLogger from '../orchestrator/services/core/orchestrator-logger';
import OrchestratorOptions from '../orchestrator/options/orchestrator-options';
import Input from '../input';

export class GitRepoReader {
  public static async GetRemote() {
    if (OrchestratorOptions.providerStrategy === 'local') {
      return '';
    }
    assert(fs.existsSync(`.git`));
    const value = (await OrchestratorSystem.Run(`cd ${Input.projectPath} && git remote -v`, false, true)).replace(
      / /g,
      ``,
    );
    OrchestratorLogger.log(`value ${value}`);
    assert(value.includes('github.com'));

    return value.split('github.com')[1].split('.git')[0].slice(1);
  }

  public static async GetBranch() {
    if (OrchestratorOptions.providerStrategy === 'local') {
      return '';
    }
    assert(fs.existsSync(`.git`));

    return (await OrchestratorSystem.Run(`cd ${Input.projectPath} && git branch --show-current`, false, true))
      .split('\n')[0]
      .replace(/ /g, ``)
      .replace('/head', '');
  }
}
