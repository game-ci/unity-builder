import { BuildParameters, ImageTag } from '..';
import CloudRunner from './cloud-runner';
import Input from '../input';
import { CloudRunnerStatics } from './cloud-runner-statics';
import { TaskParameterSerializer } from './services/task-parameter-serializer';
import UnityVersioning from '../unity-versioning';

describe('Cloud Runner', () => {
  it('responds', () => {});
});
describe('Cloud Runner', () => {
  const testSecretName = 'testSecretName';
  const testSecretValue = 'testSecretValue';
  if (Input.cloudRunnerTests) {
    it('All build parameters sent to cloud runner as env vars', async () => {
      // build parameters
      Input.cliOptions = {
        versioning: 'None',
        projectPath: 'test-project',
        unityVersion: UnityVersioning.read('test-project'),
        customJob: `
        - name: 'step 1'
          image: 'alpine'
          commands: 'printenv'
          secrets:
            - name: '${testSecretName}'
              value: '${testSecretValue}'
        `,
      };
      Input.githubInputEnabled = false;
      // setup parameters
      const buildParameter = await BuildParameters.create();
      const baseImage = new ImageTag(buildParameter);
      // run the job
      const file = await CloudRunner.run(buildParameter, baseImage.toString());
      // assert results
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
          expect(newLinePurgedFile).toContain(`${element.name}=${element.value}`);
        }
      }
      Input.githubInputEnabled = true;
    }, 1000000);
    it('Run one build it should not use cache, run subsequent build which should use cache', async () => {
      Input.cliOptions = {
        versioning: 'None',
        projectPath: 'test-project',
        unityVersion: UnityVersioning.read('test-project'),
      };
      Input.githubInputEnabled = false;
      const buildParameter = await BuildParameters.create();
      const baseImage = new ImageTag(buildParameter);
      const results = await CloudRunner.run(buildParameter, baseImage.toString());
      expect(results).toContain('library not included');
      const results2 = await CloudRunner.run(buildParameter, baseImage.toString());
      expect(results2).toContain('library included');
      Input.githubInputEnabled = true;
    }, 1000000);
  }
});
