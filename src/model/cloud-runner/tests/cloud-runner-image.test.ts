import { BuildParameters, ImageTag } from '../..';
import UnityVersioning from '../../unity-versioning';
import { Cli } from '../../cli/cli';
import GitHub from '../../github';
import setups from './cloud-runner-suite.test';

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

describe('Cloud Runner Image', () => {
  setups();
  const testSecretName = 'testSecretName';
  const testSecretValue = 'testSecretValue';
  it('Can create valid image from normal config', async () => {
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
    });
    const baseImage = new ImageTag(buildParameter);
    if (buildParameter.targetPlatform === undefined) {
      throw new Error(`target platform includes undefined`);
    }
    if (baseImage.toString().includes('undefined')) {
      throw new Error(`Base image ${baseImage.toString()} includes undefined`);
    }
    if (baseImage.toString().includes('NaN')) {
      throw new Error(`Base image ${baseImage.toString()} includes nan`);
    }
  }, 1_000_000_000);
});
