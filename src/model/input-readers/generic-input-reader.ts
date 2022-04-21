import { CloudRunnerSystem } from '../cloud-runner/services/cloud-runner-system';
import Input from '../input';

export class GenericInputReader {
  public static async Run(command) {
    if (Input.cloudRunnerCluster === 'local') {
      return '';
    }

    return await CloudRunnerSystem.Run(command, false, true);
  }
}
