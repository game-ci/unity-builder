import CloudRunnerLogger from '../services/cloud-runner-logger';
import CloudRunnerSecret from '../services/cloud-runner-secret';
import { CloudRunnerState } from '../state/cloud-runner-state';
import YAML from 'yaml';
import { Input } from '../..';
import { TaskParameterSerializer } from '../services/task-parameter-serializer';

export class CustomWorkflow {
  public static async runCustomJob(buildSteps) {
    try {
      CloudRunnerLogger.log(`Cloud Runner is running in custom job mode`);
      try {
        buildSteps = YAML.parse(buildSteps);
        for (const step of buildSteps) {
          const stepSecrets: CloudRunnerSecret[] = step.secrets.map((x) => {
            const secret: CloudRunnerSecret = {
              ParameterKey: x.name,
              EnvironmentVariable: Input.ToEnvVarFormat(x.name),
              ParameterValue: x.value,
            };
            return secret;
          });
          await CloudRunnerState.CloudRunnerProviderPlatform.runTask(
            CloudRunnerState.buildParams.buildGuid,
            step['image'],
            step['commands'],
            `/${CloudRunnerState.buildVolumeFolder}`,
            `/${CloudRunnerState.buildVolumeFolder}`,
            TaskParameterSerializer.readBuildEnvironmentVariables(),
            [...CloudRunnerState.defaultSecrets, ...stepSecrets],
          );
        }
      } catch (error) {
        CloudRunnerLogger.log(`failed to parse a custom job "${buildSteps}"`);
        throw error;
      }
    } catch (error) {
      throw error;
    }
  }
}
