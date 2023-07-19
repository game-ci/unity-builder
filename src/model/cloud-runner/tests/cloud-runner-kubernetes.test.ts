import BuildParameters from '../../build-parameters';
import { Cli } from '../../cli/cli';
import ImageTag from '../../image-tag';
import UnityVersioning from '../../unity-versioning';
import CloudRunner from '../cloud-runner';
import CloudRunnerOptions from '../options/cloud-runner-options';
import CloudRunnerLogger from '../services/core/cloud-runner-logger';
import setups from './cloud-runner-suite.test';
import { v4 as uuidv4 } from 'uuid';

async function CreateParameters(overrides: any) {
  if (overrides) {
    Cli.options = overrides;
  }

  return await BuildParameters.create();
}

describe('Cloud Runner Kubernetes', () => {
  it('Responds', () => {});
  setups();
  if (CloudRunnerOptions.cloudRunnerDebug) {
    it('Build can contact log service', async () => {
      const overrides = {
        versioning: 'None',
        projectPath: 'test-project',
        unityVersion: UnityVersioning.determineUnityVersion('test-project', UnityVersioning.read('test-project')),
        targetPlatform: 'StandaloneLinux64',
        cacheKey: `test-case-${uuidv4()}`,
        containerHookFiles: `debug-cache`,
        customJob: `
        - name: 'step 1'
          image: 'ubuntu'
          commands: 'curl http://$LOG_SERVICE_IP:80''`,
      };
      if (CloudRunnerOptions.providerStrategy !== `k8s`) {
        return;
      }
      const buildParameter = await CreateParameters(overrides);
      expect(buildParameter.projectPath).toEqual(overrides.projectPath);

      const baseImage = new ImageTag(buildParameter);
      const results = await CloudRunner.run(buildParameter, baseImage.toString());

      CloudRunnerLogger.log(results);

      CloudRunnerLogger.log(`run 1 succeeded`);
    }, 1_000_000_000);
  }
});
