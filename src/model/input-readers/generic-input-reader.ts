import { CloudRunnerSystem } from '../cloud-runner/services/cloud-runner-system';
import CloudRunnerOptions from '../cloud-runner/cloud-runner-options';

export class GenericInputReader {
  public static async Run(command: string) {
    if (CloudRunnerOptions.cloudRunnerCluster === 'local') {
      return '';
    }

    return await CloudRunnerSystem.Run(command, false, true);
  }
}
