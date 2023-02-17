import { BuildParameters, ImageTag } from '../..';
import CloudRunner from '../cloud-runner';
import Input from '../../input';
import { CloudRunnerStatics } from '../cloud-runner-statics';
import { TaskParameterSerializer } from '../services/task-parameter-serializer';
import UnityVersioning from '../../unity-versioning';
import { Cli } from '../../cli/cli';
import CloudRunnerLogger from '../services/cloud-runner-logger';
import CloudRunnerOptions from '../cloud-runner-options';
import setups from './cloud-runner-suite.test';
import { OptionValues } from 'commander';

async function CreateParameters(overrides: OptionValues | undefined) {
  if (overrides) Cli.options = overrides;

  return BuildParameters.create();
}
describe('Cloud Runner Sync Environments', () => {
  setups();
  const testSecretName = 'testSecretName';
  const testSecretValue = 'testSecretValue';
  it('Responds', () => {});

  if (CloudRunnerOptions.cloudRunnerDebug) {
    it('All build parameters sent to cloud runner as env vars', async () => {
      // Setup parameters
      const buildParameter = await CreateParameters({
        versioning: 'None',
        projectPath: 'test-project',
        unityVersion: UnityVersioning.read('test-project'),
        customJob: `
        - name: 'step 1'
          image: 'ubuntu'
          commands: 'printenv'
          secrets:
            - name: '${testSecretName}'
              value: '${testSecretValue}'
        `,
      });
      const baseImage = new ImageTag(buildParameter);

      // Run the job
      const file = await CloudRunner.run(buildParameter, baseImage.toString());

      // Assert results
      // expect(file).toContain(JSON.stringify(buildParameter));
      expect(file).toContain(`${Input.ToEnvVarFormat(testSecretName)}=${testSecretValue}`);
      const environmentVariables = TaskParameterSerializer.createCloudRunnerEnvironmentVariables(buildParameter);
      const secrets = TaskParameterSerializer.readDefaultSecrets().map((x) => {
        return {
          name: x.EnvironmentVariable,
          value: x.ParameterValue,
        };
      });
      const combined = [...environmentVariables, ...secrets]
        .filter((element) => element.value !== undefined && element.value !== '' && typeof element.value !== 'function')
        .map((x) => {
          if (typeof x.value === `string`) {
            x.value = x.value.replace(/\s+/g, '');
          }

          return x;
        })
        .filter((element) => {
          return !['UNITY_LICENSE', 'CUSTOM_JOB'].includes(element.name);
        });
      const newLinePurgedFile = file
        .replace(/\s+/g, '')
        .replace(new RegExp(`\\[${CloudRunnerStatics.logPrefix}\\]`, 'g'), '');
      for (const element of combined) {
        expect(newLinePurgedFile).toContain(`${element.name}`);
        CloudRunnerLogger.log(`Contains ${element.name}`);
        const fullNameEqualValue = `${element.name}=${element.value}`;
        expect(newLinePurgedFile).toContain(fullNameEqualValue);
      }
    }, 1_000_000_000);
  }
});
