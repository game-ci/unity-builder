import { BuildParameters, ImageTag } from '../..';
import CloudRunner from '../cloud-runner';
import Input from '../../input';
import { CloudRunnerStatics } from '../cloud-runner-statics';
import { TaskParameterSerializer } from '../services/task-parameter-serializer';
import UnityVersioning from '../../unity-versioning';
import { Cli } from '../../cli/cli';
import CloudRunnerLogger from '../services/cloud-runner-logger';
import CloudRunnerOptions from '../cloud-runner-options';
import GitHub from '../../github';

async function CreateParameters(overrides) {
  if (overrides) {
    Cli.options = overrides;
  }
  const originalValue = GitHub.githubInputEnabled;
  GitHub.githubInputEnabled = false;
  const results = await BuildParameters.create();
  GitHub.githubInputEnabled = originalValue;
  delete Cli.options;

  return results;
}
describe('Cloud Runner', () => {
  const testSecretName = 'testSecretName';
  const testSecretValue = 'testSecretValue';
  it('Responds', () => {});
  if (CloudRunnerOptions.cloudRunnerTests) {
    it('All build parameters sent to cloud runner as env vars', async () => {
      // Setup parameters
      const buildParameter = await CreateParameters({
        versioning: 'None',
        projectPath: 'test-project',
        unityVersion: UnityVersioning.read('test-project'),
        targetPlatform: 'StandaloneLinux64',
        customJob: `
        - name: 'step 1'
          image: 'alpine'
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
      expect(file).toContain(JSON.stringify(buildParameter));
      expect(file).toContain(`${Input.ToEnvVarFormat(testSecretName)}=${testSecretValue}`);
      const environmentVariables = TaskParameterSerializer.readBuildEnvironmentVariables();
      const newLinePurgedFile = file
        .replace(/\s+/g, '')
        .replace(new RegExp(`\\[${CloudRunnerStatics.logPrefix}\\]`, 'g'), '');
      for (const element of environmentVariables) {
        if (element.value !== undefined && typeof element.value !== 'function') {
          if (typeof element.value === `string`) {
            element.value = element.value.replace(/\s+/g, '');
          }
          CloudRunnerLogger.log(`checking input/build param ${element.name} ${element.value}`);
        }
      }
      for (const element of environmentVariables) {
        if (element.value !== undefined && typeof element.value !== 'function') {
          expect(newLinePurgedFile).toContain(`${element.name}`);
          expect(newLinePurgedFile).toContain(`${element.name}=${element.value}`);
        }
      }
    }, 100000);
  }
});
