import CloudRunnerLogger from '../services/cloud-runner-logger.ts';
import CloudRunnerSecret from '../services/cloud-runner-secret.ts';
import { CloudRunnerFolders } from '../services/cloud-runner-folders.ts';
import YAML from '../../../../node_modules/yaml';
import { CloudRunner, Input } from '../../index.ts';

export class CustomWorkflow {
  public static async runCustomJob(buildSteps) {
    try {
      CloudRunnerLogger.log(`Cloud Runner is running in custom job mode`);
      if (CloudRunner.buildParameters.cloudRunnerIntegrationTests) {
        CloudRunnerLogger.log(`Parsing build steps: ${buildSteps}`);
      }
      try {
        buildSteps = YAML.parse(buildSteps);
      } catch (error) {
        CloudRunnerLogger.log(`failed to parse a custom job "${buildSteps}"`);
        throw error;
      }
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
        output += await CloudRunner.Provider.runTask(
          CloudRunner.buildParameters.buildGuid,
          step['image'],
          step['commands'],
          `/${CloudRunnerFolders.buildVolumeFolder}`,
          `/${CloudRunnerFolders.buildVolumeFolder}/`,
          CloudRunner.cloudRunnerEnvironmentVariables,
          [...CloudRunner.defaultSecrets, ...stepSecrets],
        );
      }

      return output;
    } catch (error) {
      throw error;
    }
  }
}
