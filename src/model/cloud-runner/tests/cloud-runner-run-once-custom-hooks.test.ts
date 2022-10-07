import CloudRunner from '../cloud-runner';
import { BuildParameters, ImageTag } from '../..';
import UnityVersioning from '../../unity-versioning';
import { Cli } from '../../cli/cli';
import CloudRunnerLogger from '../services/cloud-runner-logger';
import { v4 as uuidv4 } from 'uuid';
import CloudRunnerOptions from '../cloud-runner-options';
import setups from './cloud-runner-suite.test';

async function CreateParameters(overrides) {
  if (overrides) {
    Cli.options = overrides;
  }

  return await BuildParameters.create();
}

describe('Cloud Runner Custom Hooks', () => {
  it('Responds', () => {});
  setups();
  if (CloudRunnerOptions.cloudRunnerTests && CloudRunnerOptions.cloudRunnerCluster !== `k8s`) {
    it('Check for pre and post custom hooks run contents', async () => {
      const overrides = {
        versioning: 'None',
        projectPath: 'test-project',
        unityVersion: UnityVersioning.determineUnityVersion('test-project', UnityVersioning.read('test-project')),
        targetPlatform: 'StandaloneLinux64',
        cacheKey: `test-case-${uuidv4()}`,
      };
      const buildParameter2 = await CreateParameters(overrides);
      const baseImage2 = new ImageTag(buildParameter2);
      const results2 = await CloudRunner.run(buildParameter2, baseImage2.toString());
      CloudRunnerLogger.log(`run 2 succeeded`);

      const build2ContainsBuildSucceeded = results2.includes('Build succeeded');
      const build2ContainsPreBuildHookMessage = results2.includes('RunCustomHookFiles: before-build');
      const build2ContainsPostBuildHookMessage = results2.includes('RunCustomHookFiles: after-build');
      const build2ContainsPreBuildHookRunMessage = results2.includes('before-build hook test!');
      const build2ContainsPostBuildHookRunMessage = results2.includes('after-build hook test!');

      const build2ContainsPreBuildStepMessage = results2.includes('before-build step test!');
      const build2ContainsPostBuildStepMessage = results2.includes('after-build step test!');

      expect(build2ContainsBuildSucceeded).toBeTruthy();
      expect(build2ContainsPreBuildHookMessage).toBeTruthy();
      expect(build2ContainsPostBuildHookMessage).toBeTruthy();
      expect(build2ContainsPreBuildHookRunMessage).toBeTruthy();
      expect(build2ContainsPostBuildHookRunMessage).toBeTruthy();
      expect(build2ContainsPreBuildStepMessage).toBeTruthy();
      expect(build2ContainsPostBuildStepMessage).toBeTruthy();
    }, 10000000);
  }
});
