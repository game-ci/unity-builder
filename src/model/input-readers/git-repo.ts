import { assert } from 'node:console';
import fs from 'node:fs';
import { exec } from 'node:child_process';
import * as core from '@actions/core';
import Input from '../input';

export class GitRepoReader {
  private static async runCommand(command: string): Promise<string> {
    return new Promise<string>((resolve, reject) => {
      exec(command, { maxBuffer: 1024 * 10000 }, (error, stdout) => {
        if (error) {
          reject(error);

          return;
        }
        resolve(stdout.toString());
      });
    });
  }

  public static async GetRemote() {
    if ((Input.getInput('providerStrategy') || 'local') === 'local') {
      return '';
    }
    assert(fs.existsSync(`.git`));
    const value = (await GitRepoReader.runCommand(`cd ${Input.projectPath} && git remote -v`)).replace(/ /g, ``);
    core.info(`value ${value}`);
    assert(value.includes('github.com'));

    return value.split('github.com')[1].split('.git')[0].slice(1);
  }

  public static async GetBranch() {
    if ((Input.getInput('providerStrategy') || 'local') === 'local') {
      return '';
    }
    assert(fs.existsSync(`.git`));

    return (await GitRepoReader.runCommand(`cd ${Input.projectPath} && git branch --show-current`))
      .split('\n')[0]
      .replace(/ /g, ``)
      .replace('/head', '');
  }
}
