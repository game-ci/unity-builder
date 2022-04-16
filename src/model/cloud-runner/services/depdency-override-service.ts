import Input from '../../input';
import { CloudRunnerSystem } from './cloud-runner-system';

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
