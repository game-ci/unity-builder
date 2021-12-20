import { BuildParameters, ImageTag } from '..';
import CloudRunner from './cloud-runner';
import Input from '../input';

describe('Cloud Runner', () => {
  it('responds', () => {});
});
if (process.env.INCLUDE_CLOUD_RUNNER_TEST !== undefined) {
  describe('Cloud Runner', () => {
    it('builds', async () => {
      await runTestBuild();
    }, 500000);
  });
}

async function runTestBuild() {
  Input.cliOptions = {
    versioning: 'None',
    projectPath: 'test-project',
    customBuildSteps: `
    - name: 'step 1'
      image: 'alpine'
      commands: ['printenv']
      secrets:
        - name: 'testCustomSecret'
          value: 'VALUEXXX'
    `,
  };
  Input.githubEnabled = false;
  const buildParameter = await BuildParameters.create();
  const baseImage = new ImageTag(buildParameter);

  await CloudRunner.run(buildParameter, baseImage.toString());
}
