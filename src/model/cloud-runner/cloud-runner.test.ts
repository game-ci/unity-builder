import { BuildParameters, ImageTag } from '..';
import CloudRunner from './cloud-runner';
import Input from '../input';
import { CloudRunnerStatics } from './cloud-runner-statics';
import { TaskParameterSerializer } from './services/task-parameter-serializer';
import UnityVersioning from '../unity-versioning';
import { CLI } from '../cli/cli';

function guid() {
  return Math.trunc((1 + Math.random()) * 0x10000)
    .toString(16)
    .slice(1);
}
function guidGenerator() {
  return `${guid() + guid()}-${guid()}-${guid()}-${guid()}-${guid()}${guid()}${guid()}`;
}
describe('Cloud Runner', () => {
  it('responds', () => {});
});
describe('Cloud Runner', () => {
  const testSecretName = 'testSecretName';
  const testSecretValue = 'testSecretValue';
  it('Local cloud runner returns commands', async () => {
    // build parameters
    CLI.options = {
      versioning: 'None',
      projectPath: 'test-project',
      unityVersion: UnityVersioning.read('test-project'),
      cloudRunnerCluster: 'local',
      targetPlatform: 'StandaloneLinux64',
      customJob: `
      - name: 'step 1'
        image: 'alpine'
        commands: 'ls'
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
    await expect(CloudRunner.run(buildParameter, baseImage.toString())).resolves.not.toThrow();
    Input.githubInputEnabled = true;
    CLI.options = undefined;
  }, 1000000);
  it('Test cloud runner returns commands', async () => {
    // build parameters
    CLI.options = {
      versioning: 'None',
      projectPath: 'test-project',
      unityVersion: UnityVersioning.read('test-project'),
      cloudRunnerCluster: 'test',
      targetPlatform: 'StandaloneLinux64',
    };
    Input.githubInputEnabled = false;
    // setup parameters
    const buildParameter = await BuildParameters.create();
    const baseImage = new ImageTag(buildParameter);
    // run the job
    await expect(CloudRunner.run(buildParameter, baseImage.toString())).resolves.not.toThrow();
    Input.githubInputEnabled = true;
    CLI.options = undefined;
  }, 1000000);
  if (Input.cloudRunnerTests) {
    it('All build parameters sent to cloud runner as env vars', async () => {
      // build parameters
      CLI.options = {
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
      };
      Input.githubInputEnabled = false;
      // setup parameters
      const buildParameter = await BuildParameters.create();
      Input.githubInputEnabled = true;
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
      CLI.options = undefined;
    }, 1000000);
    it('Run one build it should not use cache, run subsequent build which should use cache', async () => {
      CLI.options = {
        versioning: 'None',
        projectPath: 'test-project',
        unityVersion: UnityVersioning.read('test-project'),
        targetPlatform: 'StandaloneLinux64',
        cacheKey: `test-case-${guidGenerator()}`,
      };
      Input.githubInputEnabled = false;
      const buildParameter = await BuildParameters.create();
      Input.githubInputEnabled = true;
      const baseImage = new ImageTag(buildParameter);
      const results = await CloudRunner.run(buildParameter, baseImage.toString());
      const libraryString = 'Rebuilding Library because the asset database could not be found!';
      expect(results).toContain(libraryString);
      const results2 = await CloudRunner.run(buildParameter, baseImage.toString());
      expect(results2).toEqual(expect.not.stringContaining(libraryString));
      CLI.options = undefined;
    }, 1000000);
  }
});
