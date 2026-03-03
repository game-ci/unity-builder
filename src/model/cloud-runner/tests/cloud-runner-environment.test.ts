import { BuildParameters, CloudRunner, ImageTag, Input } from '../..';
import { TaskParameterSerializer } from '../services/core/task-parameter-serializer';
import UnityVersioning from '../../unity-versioning';
import { Cli } from '../../cli/cli';
import GitHub from '../../github';
import setups from './cloud-runner-suite.test';
import { CloudRunnerStatics } from '../options/cloud-runner-statics';
import CloudRunnerOptions from '../options/cloud-runner-options';
import CloudRunnerLogger from '../services/core/cloud-runner-logger';

async function CreateParameters(overrides: any) {
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
        targetPlatform: 'StandaloneWindows64',
        customJob: `
        - name: 'step 1'
          image: 'ubuntu'
          commands: 'printenv'
          secrets:
            - name: '${testSecretName}'
              value: '${testSecretValue}'
        `,
        cloudRunnerDebug: true,
      });
      const baseImage = new ImageTag(buildParameter);
      if (baseImage.toString().includes('undefined')) {
        throw new Error(`Base image is undefined`);
      }

      // Run the job
      const file = (await CloudRunner.run(buildParameter, baseImage.toString())).BuildResults;

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

      // Apply the same localhost -> host.docker.internal replacement that the Docker provider does
      // This ensures the test expectations match what's actually in the output
      const endpointEnvironmentNames = new Set([
        'AWS_S3_ENDPOINT',
        'AWS_ENDPOINT',
        'AWS_CLOUD_FORMATION_ENDPOINT',
        'AWS_ECS_ENDPOINT',
        'AWS_KINESIS_ENDPOINT',
        'AWS_CLOUD_WATCH_LOGS_ENDPOINT',
        'INPUT_AWSS3ENDPOINT',
        'INPUT_AWSENDPOINT',
      ]);
      const combined = [...environmentVariables, ...secrets]
        .filter((element) => element.value !== undefined && element.value !== '' && typeof element.value !== 'function')
        .map((x) => {
          if (typeof x.value === `string`) {
            x.value = x.value.replace(/\s+/g, '');

            // Apply localhost -> host.docker.internal replacement for LocalStack endpoints
            // when using local-docker or aws provider (which uses Docker)
            if (
              endpointEnvironmentNames.has(x.name) &&
              (x.value.startsWith('http://localhost') || x.value.startsWith('http://127.0.0.1')) &&
              (CloudRunnerOptions.providerStrategy === 'local-docker' || CloudRunnerOptions.providerStrategy === 'aws')
            ) {
              x.value = x.value
                .replace('http://localhost', 'http://host.docker.internal')
                .replace('http://127.0.0.1', 'http://host.docker.internal');
            }
          }

          return x;
        })
        .filter((element) => {
          return !['UNITY_LICENSE', 'UNITY_LICENSE', 'CUSTOM_JOB', 'CUSTOM_JOB'].includes(element.name);
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

describe('Cloud Runner Environment Serializer', () => {
  setups();
  const testSecretName = 'testSecretName';
  const testSecretValue = 'testSecretValue';
  it('Cloud Runner Parameter Serialization', async () => {
    // Setup parameters
    const buildParameter = await CreateParameters({
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
    });

    const result = TaskParameterSerializer.createCloudRunnerEnvironmentVariables(buildParameter);
    expect(result.find((x) => Number.parseInt(x.name)) !== undefined).toBeFalsy();
    const result2 = TaskParameterSerializer.createCloudRunnerEnvironmentVariables(buildParameter);
    expect(result2.find((x) => Number.parseInt(x.name)) !== undefined).toBeFalsy();
  });
});
