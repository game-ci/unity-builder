import { CloudRunnerSystem } from './cloud-runner-system';
import CloudRunnerOptions from '../cloud-runner-options';

class DependencyOverrideService {
  public static async CheckHealth() {
    if (CloudRunnerOptions.checkDependencyHealthOverride) {
      try {
        await CloudRunnerSystem.Run(CloudRunnerOptions.checkDependencyHealthOverride);
      } catch {
        return false;
      }
    }

    return true;
  }
  public static async TryStartDependencies() {
    if (CloudRunnerOptions.startDependenciesOverride) {
      await CloudRunnerSystem.Run(CloudRunnerOptions.startDependenciesOverride);
    }
  }
}
export default DependencyOverrideService;
