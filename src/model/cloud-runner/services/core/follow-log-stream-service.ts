import GitHub from '../../../github';
import CloudRunner from '../../cloud-runner';
import { CloudRunnerStatics } from '../../options/cloud-runner-statics';
import CloudRunnerLogger from './cloud-runner-logger';
import * as core from '@actions/core';

export class FollowLogStreamService {
  static Reset() {
    FollowLogStreamService.DidReceiveEndOfTransmission = false;
  }
  static errors = ``;
  public static DidReceiveEndOfTransmission = false;
  public static handleIteration(message: string, shouldReadLogs: boolean, shouldCleanup: boolean, output: string) {
    if (message.includes(`---${CloudRunner.buildParameters.logId}`)) {
      CloudRunnerLogger.log('End of log transmission received');
      FollowLogStreamService.DidReceiveEndOfTransmission = true;
      shouldReadLogs = false;
    } else if (message.includes('Rebuilding Library because the asset database could not be found!')) {
      GitHub.updateGitHubCheck(`Library was not found, importing new Library`, ``);
      core.warning('LIBRARY NOT FOUND!');
      core.setOutput('library-found', 'false');
    } else if (message.includes('Build succeeded')) {
      GitHub.updateGitHubCheck(`Build succeeded`, `Build succeeded`);
      core.setOutput('build-result', 'success');
    } else if (message.includes('Build fail')) {
      GitHub.updateGitHubCheck(
        `Build failed\n${FollowLogStreamService.errors}`,
        `Build failed`,
        `failure`,
        `completed`,
      );
      core.setOutput('build-result', 'failed');
      core.setFailed('unity build failed');
      core.error('BUILD FAILED!');
    } else if (message.toLowerCase().includes('error ')) {
      core.error(message);
      FollowLogStreamService.errors += `\n${message}`;
    } else if (message.toLowerCase().includes('error: ')) {
      core.error(message);
      FollowLogStreamService.errors += `\n${message}`;
    } else if (message.toLowerCase().includes('command failed: ')) {
      FollowLogStreamService.errors += `\n${message}`;
    } else if (message.toLowerCase().includes('invalid ')) {
      FollowLogStreamService.errors += `\n${message}`;
    } else if (message.toLowerCase().includes('incompatible  ')) {
      FollowLogStreamService.errors += `\n${message}`;
    } else if (message.toLowerCase().includes('cannot be found')) {
      FollowLogStreamService.errors += `\n${message}`;
    }
    if (CloudRunner.buildParameters.cloudRunnerDebug) {
      output += `${message}\n`;
    }
    CloudRunnerLogger.log(`[${CloudRunnerStatics.logPrefix}] ${message}`);

    return { shouldReadLogs, shouldCleanup, output };
  }
}
