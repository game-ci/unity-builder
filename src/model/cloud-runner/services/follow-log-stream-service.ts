import CloudRunnerLogger from './cloud-runner-logger';
import * as core from '@actions/core';
import CloudRunner from '../cloud-runner';
import { CloudRunnerStatics } from '../cloud-runner-statics';
import GitHub from '../../github';

export class FollowLogStreamService {
  public static handleIteration(message: string, shouldReadLogs: boolean, shouldCleanup: boolean, output: string) {
    if (message.includes(`---${CloudRunner.buildParameters.logId}`)) {
      CloudRunnerLogger.log('End of log transmission received');
      shouldReadLogs = false;
    } else if (message.includes('Rebuilding Library because the asset database could not be found!')) {
      GitHub.updateGitHubCheck(`Library was not found, importing new Library`, ``);
      core.warning('LIBRARY NOT FOUND!');
      core.setOutput('library-found', 'false');
    } else if (message.includes('Build succeeded')) {
      GitHub.updateGitHubCheck(`Build succeeded`, `Build succeeded`);
      core.setOutput('build-result', 'success');
    } else if (message.includes('Build fail')) {
      GitHub.updateGitHubCheck(`Build failed`, `Build failed`);
      core.setOutput('build-result', 'failed');
      core.setFailed('unity build failed');
      core.error('BUILD FAILED!');
    } else if (CloudRunner.buildParameters.cloudRunnerDebug && message.includes(': Listening for Jobs')) {
      core.setOutput('cloud runner stop watching', 'true');
      shouldReadLogs = false;
      shouldCleanup = false;
      core.warning('cloud runner stop watching');
    }
    if (CloudRunner.buildParameters.cloudRunnerDebug) {
      output += `${message}\n`;
    }
    CloudRunnerLogger.log(`[${CloudRunnerStatics.logPrefix}] ${message}`);

    return { shouldReadLogs, shouldCleanup, output };
  }
}
