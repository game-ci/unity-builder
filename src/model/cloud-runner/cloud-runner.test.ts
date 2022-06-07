import { BuildParameters, ImageTag } from '..';
import CloudRunner from './cloud-runner.ts';
import Input from '../input.ts';
import { CloudRunnerStatics } from './cloud-runner-statics.ts';
import { TaskParameterSerializer } from './services/task-parameter-serializer.ts';
import UnityVersioning from '../unity-versioning.ts';
import { Cli } from '../cli/cli.ts';
import CloudRunnerLogger from './services/cloud-runner-logger.ts';
import { v4 as uuidv4 } from '../../../node_modules/uuid';

describe('Cloud Runner', () => {
  it('responds', () => {});
});
describe('Cloud Runner', () => {
  const testSecretName = 'testSecretName';
  const testSecretValue = 'testSecretValue';
  if (Input.cloudRunnerTests) {
    it('All build parameters sent to cloud runner as env vars', async () => {
      // Build parameters
      Cli.options = {
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

      // Setup parameters
      const buildParameter = await BuildParameters.create();
      Input.githubInputEnabled = true;
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
      delete Cli.options;
    }, 1000000);
    it('Run one build it should not use cache, run subsequent build which should use cache', async () => {
      Cli.options = {
        versioning: 'None',
        projectPath: 'test-project',
        unityVersion: UnityVersioning.determineUnityVersion('test-project', UnityVersioning.read('test-project')),
        targetPlatform: 'StandaloneLinux64',
        cacheKey: `test-case-${uuidv4()}`,
      };
      Input.githubInputEnabled = false;
      const buildParameter = await BuildParameters.create();
      const baseImage = new ImageTag(buildParameter);
      const results = await CloudRunner.run(buildParameter, baseImage.toString());
      const libraryString = 'Rebuilding Library because the asset database could not be found!';
      const buildSucceededString = 'Build succeeded';
      expect(results).toContain(libraryString);
      expect(results).toContain(buildSucceededString);
      CloudRunnerLogger.log(`run 1 succeeded`);
      const buildParameter2 = await BuildParameters.create();
      const baseImage2 = new ImageTag(buildParameter2);
      const results2 = await CloudRunner.run(buildParameter2, baseImage2.toString());
      CloudRunnerLogger.log(`run 2 succeeded`);
      expect(results2).toContain(buildSucceededString);
      expect(results2).toEqual(expect.not.stringContaining(libraryString));
      Input.githubInputEnabled = true;
      delete Cli.options;
    }, 1000000);
  }
  it('Local cloud runner returns commands', async () => {
    // Build parameters
    Cli.options = {
      versioning: 'None',
      projectPath: 'test-project',
      unityVersion: UnityVersioning.read('test-project'),
      cloudRunnerCluster: 'local-system',
      targetPlatform: 'StandaloneLinux64',
      customJob: `
      - name: 'step 1'
        image: 'alpine'
        commands: 'dir'
        secrets:
          - name: '${testSecretName}'
            value: '${testSecretValue}'
      `,
    };
    Input.githubInputEnabled = false;

    // Setup parameters
    const buildParameter = await BuildParameters.create();
    const baseImage = new ImageTag(buildParameter);

    // Run the job
    await expect(CloudRunner.run(buildParameter, baseImage.toString())).resolves.not.toThrow();
    Input.githubInputEnabled = true;
    delete Cli.options;
  }, 1000000);
  it('Test cloud runner returns commands', async () => {
    // Build parameters
    Cli.options = {
      versioning: 'None',
      projectPath: 'test-project',
      unityVersion: UnityVersioning.read('test-project'),
      cloudRunnerCluster: 'test',
      targetPlatform: 'StandaloneLinux64',
    };
    Input.githubInputEnabled = false;

    // Setup parameters
    const buildParameter = await BuildParameters.create();
    const baseImage = new ImageTag(buildParameter);

    // Run the job
    await expect(CloudRunner.run(buildParameter, baseImage.toString())).resolves.not.toThrow();
    Input.githubInputEnabled = true;
    delete Cli.options;
  }, 1000000);
});
