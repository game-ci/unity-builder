import { ImageTag } from '../..';
import CloudRunner from '../cloud-runner';
import UnityVersioning from '../../unity-versioning';
import CloudRunnerOptions from '../cloud-runner-options';
import setups from './cloud-runner-suite.test';
import fs from 'fs';
import { CreateParameters } from './create-test-parameter';
import CloudRunnerLogger from '../services/cloud-runner-logger';

describe('Cloud Runner Local Docker Workflows', () => {
  setups();
  it('Responds', () => {});

  if (CloudRunnerOptions.cloudRunnerCluster === `local-docker`) {
    it('inspect stateful folder of Workflows', async () => {
      const testValue = `the state in a job exits in the expected local-docker folder`;
      fs.writeFileSync(`./cloud-runner-cache/test-in-state.txt`, testValue);

      // Setup parameters
      const buildParameter = await CreateParameters({
        versioning: 'None',
        projectPath: 'test-project',
        unityVersion: UnityVersioning.read('test-project'),
        customJob: `
        - name: 'step 1'
          image: 'ubuntu'
          commands: 'ls /data/ && cat /data/test-in-state.txt >> /data/test-out-state.txt'
        `,
      });
      const baseImage = new ImageTag(buildParameter);

      // Run the job
      await CloudRunner.run(buildParameter, baseImage.toString());

      const outputFile = fs.readFileSync(`./cloud-runner-cache/state.txt`, `utf-8`);
      expect(outputFile).toEqual(testValue);
      CloudRunnerLogger.log(outputFile);
    }, 1_000_000_000);
  }
});