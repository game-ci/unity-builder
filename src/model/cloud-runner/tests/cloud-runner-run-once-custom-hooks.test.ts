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
    it('Run one build it should not already be retained, run subsequent build which should use retained workspace', async () => {
      const overrides = {
        versioning: 'None',
        projectPath: 'test-project',
        unityVersion: UnityVersioning.determineUnityVersion('test-project', UnityVersioning.read('test-project')),
        targetPlatform: 'StandaloneLinux64',
        cacheKey: `test-case-${uuidv4()}`,
        retainWorkspaces: true,
      };
      const buildParameter2 = await CreateParameters(overrides);
      const baseImage2 = new ImageTag(buildParameter2);
      const results2 = await CloudRunner.run(buildParameter2, baseImage2.toString());
      CloudRunnerLogger.log(`run 2 succeeded`);

      const build2ContainsRetainedWorkspacePhrase = results2.includes(`Retained Workspace:`);
      const build2ContainsWorkspaceExistsAlreadyPhrase = results2.includes(`Retained Workspace Already Exists!`);
      const build2ContainsBuildSucceeded = results2.includes('Build succeeded');
      const build2ContainsPreBuildHookMessage = results2.includes('pre-build test!');
      const build2ContainsPostBuildHookMessage = results2.includes('post-build test!');

      expect(build2ContainsRetainedWorkspacePhrase).toBeTruthy();
      expect(build2ContainsWorkspaceExistsAlreadyPhrase).toBeTruthy();
      expect(build2ContainsBuildSucceeded).toBeTruthy();
      expect(build2ContainsPreBuildHookMessage).toBeTruthy();
      expect(build2ContainsPostBuildHookMessage).toBeTruthy();
    }, 10000000);
  }
});
