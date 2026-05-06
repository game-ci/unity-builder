import { exec } from 'node:child_process';
import * as core from '@actions/core';
import Input from '../input';

export class GithubCliReader {
  private static async runCommand(command: string, suppressError = false): Promise<string> {
    return new Promise<string>((resolve, reject) => {
      exec(command, { maxBuffer: 1024 * 10000 }, (error, stdout, stderr) => {
        if (error && !suppressError) {
          reject(error);

          return;
        }
        resolve((stdout || '').toString() + (stderr || '').toString());
      });
    });
  }

  static async GetGitHubAuthToken() {
    if ((Input.getInput('providerStrategy') || 'local') === 'local') {
      return '';
    }
    try {
      const authStatus = await GithubCliReader.runCommand(`gh auth status`, true);
      if (authStatus.includes('You are not logged') || authStatus === '') {
        return '';
      }

      return (await GithubCliReader.runCommand(`gh auth status -t`))
        .split(`Token: `)[1]
        .replace(/ /g, '')
        .replace(/\n/g, '');
    } catch (error: any) {
      core.info(error || 'Failed to get github auth token from gh cli');

      return '';
    }
  }
}
