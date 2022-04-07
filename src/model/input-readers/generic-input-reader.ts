import { CloudRunnerSystem } from '../cloud-runner/remote-client/cloud-runner-system';

export class GenericInputReader {
  public static async Run(command) {
    return await CloudRunnerSystem.Run(command, false, true);
  }
}
