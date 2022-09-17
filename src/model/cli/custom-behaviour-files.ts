import CloudRunnerLogger from '../cloud-runner/services/cloud-runner-logger';
import { CliFunction } from './cli-functions-repository';

export class CustomBehaviourFiles {
  @CliFunction(`run-hooks`, `runs custom hooks`)
  public static async RunCustomHookFiles() {
    CloudRunnerLogger.log('Run custom hooks');
  }
}

export default CustomBehaviourFiles;
