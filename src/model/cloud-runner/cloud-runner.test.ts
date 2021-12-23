import { BuildParameters, ImageTag } from '..';
import CloudRunner from './cloud-runner';
import Input from '../input';
import fs from 'fs';
import { CloudRunnerState } from './state/cloud-runner-state';

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
  it('All build parameters sent to cloud runner as env vars', async () => {
    if (Input.remoteBuilderIntegrationTests) {
      const buildParameter = await BuildParameters.create();
      buildParameter.logToFile = true;
      const baseImage = new ImageTag(buildParameter);
      await CloudRunner.run(buildParameter, baseImage.toString());
      const file = fs.readFileSync(`${CloudRunnerState.buildGuid}-outputfile.txt`, 'utf-8').toString();
      // eslint-disable-next-line no-console
      console.log(file);
      const buildParameterKeys = Object.keys(buildParameter);
      for (const element of buildParameterKeys) {
        if (buildParameter[element] !== undefined) {
          expect(file).toContain(`${element}":"${buildParameter[element]}`);
        }
      }
      const inputKeys = Object.getOwnPropertyNames(Input);
      for (const element of inputKeys) {
        if (Input[element] !== undefined) {
          expect(file).toContain(`${element}=${Input[element]}`);
        }
      }
    }
  }, 500000);
});
