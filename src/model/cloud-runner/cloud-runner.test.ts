import { BuildParameters, ImageTag } from '..';
import CloudRunner from './cloud-runner';
import Input from '../input';
import fs from 'fs';
import { CloudRunnerState } from './state/cloud-runner-state';
import { CloudRunnerClientStatics } from '../cli/cloud-runner-client/cloud-runner-client-statics';

describe('Cloud Runner', () => {
  it('responds', () => {});
});
describe('Cloud Runner', () => {
  const testSecretName = 'testSecretName';
  const testSecretValue = 'testSecretValue';
  Input.cliOptions = {
    versioning: 'None',
    projectPath: 'test-project',
    customBuildSteps: `
    - name: 'step 1'
      image: 'alpine'
      commands: ['printenv']
      secrets:
        - name: '${testSecretName}'
          value: '${testSecretValue}'
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
      expect(file).toContain(JSON.stringify(buildParameter));
      expect(file).toContain(`${testSecretName}=${testSecretValue}`);
      const inputKeys = Object.getOwnPropertyNames(Input);
      for (const element of inputKeys) {
        if (Input[element] !== undefined && typeof Input[element] != 'function') {
          expect(
            file.replace(/\s+/g, '').replace(new RegExp(`\\[${CloudRunnerClientStatics.logPrefix}\\]`, 'g'), ''),
          ).toContain(`${element}=${Input[element].toString().replace(/\s+/g, '')}`);
        }
      }
    }
  }, 500000);
});
