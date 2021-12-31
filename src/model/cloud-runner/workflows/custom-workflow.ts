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
      if (Input.cloudRunnerTests) {
        CloudRunnerLogger.log(`Parsing build steps: ${buildSteps}`);
      }
      try {
        buildSteps = YAML.parse(buildSteps);
        let output = '';
        for (const step of buildSteps) {
          const stepSecrets: CloudRunnerSecret[] = step.secrets.map((x) => {
            const secret: CloudRunnerSecret = {
              ParameterKey: x.name,
              EnvironmentVariable: Input.ToEnvVarFormat(x.name),
              ParameterValue: x.value,
            };
            return secret;
          });
          output += await CloudRunnerState.CloudRunnerProviderPlatform.runTask(
            CloudRunnerState.buildParams.buildGuid,
            step['image'],
            step['commands'],
            `/${CloudRunnerState.buildVolumeFolder}`,
            `/${CloudRunnerState.buildVolumeFolder}`,
            TaskParameterSerializer.readBuildEnvironmentVariables(),
            [...CloudRunnerState.defaultSecrets, ...stepSecrets],
          );
        }
        return output;
      } catch (error) {
        CloudRunnerLogger.log(`failed to parse a custom job "${buildSteps}"`);
        throw error;
      }
    } catch (error) {
      throw error;
    }
  }
}
