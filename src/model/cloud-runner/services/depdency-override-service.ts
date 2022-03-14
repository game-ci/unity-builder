import { CloudRunnerSystem } from '../../cli/remote-client/remote-client-services/cloud-runner-system';
import Input from '../../input';

class DependencyOverrideService {
  public static async CheckHealth() {
    if (Input.checkDependencyHealthOverride) {
      try {
        await CloudRunnerSystem.Run(Input.checkDependencyHealthOverride);
      } catch {
        return false;
      }
    }
    return true;
  }
  public static async TryStartDependencies() {
    if (Input.startDependenciesOverride) {
      await CloudRunnerSystem.Run(Input.startDependenciesOverride);
    }
  }
}
export default DependencyOverrideService;
