import { BuildParameters, ImageTag } from '..';
import CloudRunner from './cloud-runner';
import Input from '../input';

describe('Cloud Runner', () => {
  it('builds', async () => {
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
  }, 500000);
});
if (process.env.GITHUB_SHA !== undefined) {
  describe('Cloud Runner Remote', () => {
    it('builds', async () => {
      const buildParameter = await BuildParameters.create();
      const baseImage = new ImageTag(buildParameter);
      await CloudRunner.run(buildParameter, baseImage.toString());
    });
  });
}
