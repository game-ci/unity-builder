import { CloudRunnerSystem } from '../cli/remote-client/remote-client-services/cloud-runner-system';

export class GenericInputReader {
  public static async Run(command) {
    return await CloudRunnerSystem.Run(command);
  }
}
