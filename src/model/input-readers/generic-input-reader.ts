import { CloudRunnerSystem } from '../cloud-runner/services/core/cloud-runner-system';
import CloudRunnerOptions from '../cloud-runner/options/cloud-runner-options';

export class GenericInputReader {
  public static async Run(command: string) {
    if (CloudRunnerOptions.providerStrategy === 'local') {
      return '';
    }

    return await CloudRunnerSystem.Run(command, false, true);
  }
}
