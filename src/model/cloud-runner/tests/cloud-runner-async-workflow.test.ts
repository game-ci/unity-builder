import { BuildParameters, ImageTag } from '../..';
import CloudRunner from '../cloud-runner';
import UnityVersioning from '../../unity-versioning';
import { Cli } from '../../cli/cli';
import CloudRunnerOptions from '../options/cloud-runner-options';
import setups from './cloud-runner-suite.test';
import { OptionValues } from 'commander';

async function CreateParameters(overrides: OptionValues | undefined) {
  if (overrides) Cli.options = overrides;

  return BuildParameters.create();
}
describe('Cloud Runner Async Workflows', () => {
  setups();
  it('Responds', () => {});

  if (CloudRunnerOptions.cloudRunnerDebug && CloudRunnerOptions.providerStrategy !== `local-docker`) {
    it('Async Workflows', async () => {
      // Setup parameters
      const buildParameter = await CreateParameters({
        versioning: 'None',
        projectPath: 'test-project',
        unityVersion: UnityVersioning.read('test-project'),
        asyncCloudRunner: `true`,
        githubChecks: `true`,
      });
      const baseImage = new ImageTag(buildParameter);

      // Run the job
      await CloudRunner.run(buildParameter, baseImage.toString());
    }, 1_000_000_000);
  }
});
