import Input from '../../input.ts';
import { CloudRunnerSystem } from './cloud-runner-system.ts';

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
