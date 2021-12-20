import { BuildParameters, ImageTag } from '..';
import CloudRunner from './cloud-runner';
import Input from '../input';

describe('Cloud Runner', () => {
  it('responds', () => {});
});
describe('Cloud Runner', () => {
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
  it('builds', async () => {
    if (Input.remoteBuilderIntegrationTests) {
      const buildParameter = await BuildParameters.create();
      buildParameter.logToFile = true;
      const baseImage = new ImageTag(buildParameter);
      await CloudRunner.run(buildParameter, baseImage.toString());
    }
  }, 500000);
});
