import { BuildParameters } from '../..';
import { TaskParameterSerializer } from '../services/task-parameter-serializer';
import UnityVersioning from '../../unity-versioning';
import { Cli } from '../../cli/cli';
import GitHub from '../../github';
import setups from './cloud-runner-suite.test';
import * as core from '@actions/core';

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

    const result = TaskParameterSerializer.readBuildEnvironmentVariables(buildParameter);
    core.info(JSON.stringify(result, undefined, 4));
    expect(result.find((x) => Number.parseInt(x.name)) !== undefined).toBeFalsy();
  });
});
