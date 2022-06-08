import CloudRunnerLogger from './cloud-runner-logger.ts';
import { core } from '../../dependencies.ts';
import CloudRunner from '../cloud-runner.ts';
import { CloudRunnerStatics } from '../cloud-runner-statics.ts';

export class FollowLogStreamService {
  public static handleIteration(message, shouldReadLogs, shouldCleanup, output) {
    if (message.includes(`---${CloudRunner.buildParameters.logId}`)) {
      CloudRunnerLogger.log('End of log transmission received');
      shouldReadLogs = false;
    } else if (message.includes('Rebuilding Library because the asset database could not be found!')) {
      core.warning('LIBRARY NOT FOUND!');
      core.setOutput('library-found', 'false');
    } else if (message.includes('Build succeeded')) {
      core.setOutput('build-result', 'success');
    } else if (message.includes('Build fail')) {
      core.setOutput('build-result', 'failed');
      core.setFailed('unity build failed');
      core.error('BUILD FAILED!');
    } else if (CloudRunner.buildParameters.cloudRunnerIntegrationTests && message.includes(': Listening for Jobs')) {
      core.setOutput('cloud runner stop watching', 'true');
      shouldReadLogs = false;
      shouldCleanup = false;
      core.warning('cloud runner stop watching');
    }
    message = `[${CloudRunnerStatics.logPrefix}] ${message}`;
    if (CloudRunner.buildParameters.cloudRunnerIntegrationTests) {
      output += message;
    }
    CloudRunnerLogger.log(message);

    return { shouldReadLogs, shouldCleanup, output };
  }
}
