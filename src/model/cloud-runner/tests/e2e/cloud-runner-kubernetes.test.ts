import CloudRunner from '../../cloud-runner';
import UnityVersioning from '../../../unity-versioning';
import { Cli } from '../../../cli/cli';
import CloudRunnerLogger from '../../services/core/cloud-runner-logger';
import { v4 as uuidv4 } from 'uuid';
import CloudRunnerOptions from '../../options/cloud-runner-options';
import setups from '../cloud-runner-suite.test';
import BuildParameters from '../../../build-parameters';
import ImageTag from '../../../image-tag';

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
    it('Run one build it using K8s without error', async () => {
      if (CloudRunnerOptions.providerStrategy !== `k8s`) {
        return;
      }
      process.env.USE_IL2CPP = 'false';
      const overrides = {
        versioning: 'None',
        projectPath: 'test-project',
        unityVersion: UnityVersioning.determineUnityVersion('test-project', UnityVersioning.read('test-project')),
        targetPlatform: 'StandaloneLinux64',
        cacheKey: `test-case-${uuidv4()}`,
        providerStrategy: 'k8s',
        buildPlatform: 'linux',
      };
      const buildParameter = await CreateParameters(overrides);
      expect(buildParameter.projectPath).toEqual(overrides.projectPath);

      const baseImage = new ImageTag(buildParameter);
      const resultsObject = await CloudRunner.run(buildParameter, baseImage.toString());
      const results = resultsObject.BuildResults;
      const libraryString = 'Rebuilding Library because the asset database could not be found!';
      const cachePushFail = 'Did not push source folder to cache because it was empty Library';
      const buildSucceededString = 'Build succeeded';

      expect(results).toContain('Collected Logs');
      expect(results).toContain(libraryString);
      expect(results).toContain(buildSucceededString);
      expect(results).not.toContain(cachePushFail);

      CloudRunnerLogger.log(`run 1 succeeded`);
    }, 1_000_000_000);
  }
});
