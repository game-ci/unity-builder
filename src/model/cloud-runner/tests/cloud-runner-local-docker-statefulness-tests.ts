import { BuildParameters, ImageTag } from '../..';
import CloudRunner from '../cloud-runner';
import UnityVersioning from '../../unity-versioning';
import { Cli } from '../../cli/cli';
import CloudRunnerOptions from '../cloud-runner-options';
import setups from './cloud-runner-suite.test';

async function CreateParameters(overrides) {
  if (overrides) Cli.options = overrides;

  return BuildParameters.create();
}
describe('Cloud Runner Local Docker Workflows', () => {
  setups();
  it('Responds', () => {});

  if (CloudRunnerOptions.cloudRunnerCluster === `local-docker`) {
    it('inspect stateful folder of Workflows', async () => {
      // Setup parameters
      const buildParameter = await CreateParameters({
        versioning: 'None',
        projectPath: 'test-project',
        unityVersion: UnityVersioning.read('test-project'),
        customJob: `
        - name: 'step 1'
          image: 'ubuntu'
          commands: 'ls /data/'s
        `,
      });
      const baseImage = new ImageTag(buildParameter);

      // Run the job
      await CloudRunner.run(buildParameter, baseImage.toString());
    }, 1_000_000_000);
  }
});
