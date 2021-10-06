import CloudRunnerLogger from '../services/cloud-runner-logger';
import CloudRunnerSecret from '../services/cloud-runner-secret';
import { CloudRunnerState } from '../state/cloud-runner-state';
import YAML from 'yaml';

export class CustomStep {
  public static async runCustomJob(buildSteps) {
    CloudRunnerLogger.log(`Cloud Runner is running in custom job mode`);
    buildSteps = YAML.parse(buildSteps);
    for (const step of buildSteps) {
      const stepSecrets: CloudRunnerSecret[] = step.secrets.map((x) => {
        const secret: CloudRunnerSecret = {
          ParameterKey: x.name,
          EnvironmentVariable: x.name,
          ParameterValue: x.value,
        };
        return secret;
      });
      await CloudRunnerState.CloudRunnerProviderPlatform.runBuildTask(
        CloudRunnerState.buildGuid,
        step['image'],
        step['commands'],
        `/${CloudRunnerState.buildVolumeFolder}`,
        `/${CloudRunnerState.buildVolumeFolder}`,
        CloudRunnerState.defaultGitShaEnvironmentVariable,
        [...CloudRunnerState.defaultSecrets, ...stepSecrets],
      );
    }
  }
}
