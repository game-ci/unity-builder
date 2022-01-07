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
      const buildParameter = await BuildParameters.create();
      const baseImage = new ImageTag(buildParameter);
      const file = await CloudRunner.run(buildParameter, baseImage.toString());
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
    it('Caches Library and LFS', async () => {
      Input.githubInputEnabled = false;
      Input.cliOptions = {
        versioning: 'None',
        projectPath: 'test-project',
        unityVersion: UnityVersioning.read('test-project'),
        customJob: `
        - name: 'step 1'
          image: 'alpine'
          commands: '
              cd 0-windows64-13xi
              ls'
          secrets:
            - name: '${testSecretName}'
              value: '${testSecretValue}'
        `,
      };
      let buildParameter = await BuildParameters.create();
      let baseImage = new ImageTag(buildParameter);
      await CloudRunner.run(buildParameter, baseImage.toString());
      Input.cliOptions = {
        versioning: 'None',
        projectPath: 'test-project',
        unityVersion: UnityVersioning.read('test-project'),
        customJob: `setup`,
      };
      buildParameter = await BuildParameters.create();
      baseImage = new ImageTag(buildParameter);
      await CloudRunner.run(buildParameter, baseImage.toString());
      Input.cliOptions = {
        versioning: 'None',
        projectPath: 'test-project',
        unityVersion: UnityVersioning.read('test-project'),
        customJob: `
        - name: 'step 1'
          image: 'alpine'
          commands: 'ls'
          secrets:
            - name: '${testSecretName}'
              value: '${testSecretValue}'
        `,
      };
      buildParameter = await BuildParameters.create();
      baseImage = new ImageTag(buildParameter);
      await CloudRunner.run(buildParameter, baseImage.toString());
      Input.githubInputEnabled = true;
    }, 1000000);
  }
});
