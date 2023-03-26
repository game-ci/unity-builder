import { ImageTag } from '../..';
import CloudRunner from '../cloud-runner';
import UnityVersioning from '../../unity-versioning';
import CloudRunnerOptions from '../options/cloud-runner-options';
import setups from './cloud-runner-suite.test';
import fs from 'node:fs';
import { CreateParameters } from './create-test-parameter';
import CloudRunnerLogger from '../services/core/cloud-runner-logger';

describe('Cloud Runner Local Docker Workflows', () => {
  setups();
  it('Responds', () => {});

  if (CloudRunnerOptions.providerStrategy === `local-docker`) {
    it('inspect stateful folder of workflows', async () => {
      const testValue = `the state in a job exits in the expected local-docker folder`;

      // Setup parameters
      const buildParameter = await CreateParameters({
        versioning: 'None',
        projectPath: 'test-project',
        unityVersion: UnityVersioning.read('test-project'),
        customJob: `
        - name: 'step 1'
          image: 'ubuntu'
          commands: 'echo "${testValue}" >> /data/test-out-state.txt'
        `,
      });
      const buildParameter2 = await CreateParameters({
        versioning: 'None',
        projectPath: 'test-project',
        unityVersion: UnityVersioning.read('test-project'),
        customJob: `
        - name: 'step 1'
          image: 'ubuntu'
          commands: 'cat /data/test-out-state.txt >> /data/test-out-state-2.txt'
        `,
      });
      const baseImage = new ImageTag(buildParameter);

      // Run the job
      await CloudRunner.run(buildParameter, baseImage.toString());
      await CloudRunner.run(buildParameter2, baseImage.toString());

      const outputFile = fs.readFileSync(`./cloud-runner-cache/test-out-state.txt`, `utf-8`);
      expect(outputFile).toMatch(testValue);

      const outputFile2 = fs.readFileSync(`./cloud-runner-cache/test-out-state-2.txt`, `utf-8`);
      expect(outputFile2).toMatch(testValue);
      CloudRunnerLogger.log(outputFile);
    }, 1_000_000_000);
  }
});
