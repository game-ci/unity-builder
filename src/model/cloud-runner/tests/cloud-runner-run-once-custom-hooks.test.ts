import CloudRunner from '../cloud-runner';
import { BuildParameters, ImageTag } from '../..';
import UnityVersioning from '../../unity-versioning';
import { Cli } from '../../cli/cli';
import CloudRunnerLogger from '../services/cloud-runner-logger';
import { v4 as uuidv4 } from 'uuid';
import CloudRunnerOptions from '../cloud-runner-options';
import setups from './cloud-runner-suite.test';
import { CloudRunnerCustomSteps } from '../services/cloud-runner-custom-steps';

async function CreateParameters(overrides) {
  if (overrides) {
    Cli.options = overrides;
  }

  return await BuildParameters.create();
}

describe('Cloud Runner Custom Hooks And Steps', () => {
  it('Responds', () => {});
  setups();
  it('Check parsing and reading of steps', async () => {
    const yamlString = `hook: before
commands: echo "test"`;
    const yamlString2 = `- hook: before
  commands: echo "test"`;
    const overrides = {
      versioning: 'None',
      projectPath: 'test-project',
      unityVersion: UnityVersioning.determineUnityVersion('test-project', UnityVersioning.read('test-project')),
      targetPlatform: 'StandaloneLinux64',
      cacheKey: `test-case-${uuidv4()}`,
    };
    CloudRunner.setup(await CreateParameters(overrides));
    const stringObject = CloudRunnerCustomSteps.ParseSteps(yamlString);
    const stringObject2 = CloudRunnerCustomSteps.ParseSteps(yamlString2);

    CloudRunnerLogger.log(yamlString);
    CloudRunnerLogger.log(JSON.stringify(stringObject, undefined, 4));

    expect(stringObject.length).toBe(1);
    expect(stringObject[0].hook).toBe(`before`);
    expect(stringObject2.length).toBe(1);
    expect(stringObject2[0].hook).toBe(`before`);

    const getCustomStepsFromFiles = CloudRunnerCustomSteps.GetCustomStepsFromFiles(`before`);
    CloudRunnerLogger.log(JSON.stringify(getCustomStepsFromFiles, undefined, 4));
  });
  if (CloudRunnerOptions.cloudRunnerDebug && CloudRunnerOptions.cloudRunnerCluster !== `k8s`) {
    it('Run build once - check for pre and post custom hooks run contents', async () => {
      const overrides = {
        versioning: 'None',
        projectPath: 'test-project',
        unityVersion: UnityVersioning.determineUnityVersion('test-project', UnityVersioning.read('test-project')),
        targetPlatform: 'StandaloneLinux64',
        cacheKey: `test-case-${uuidv4()}`,
        customStepFiles: `my-test-step-pre-build,my-test-step-post-build`,
      };
      const buildParameter2 = await CreateParameters(overrides);
      const baseImage2 = new ImageTag(buildParameter2);
      const results2 = await CloudRunner.run(buildParameter2, baseImage2.toString());
      CloudRunnerLogger.log(`run 2 succeeded`);

      const build2ContainsBuildSucceeded = results2.includes('Build succeeded');
      const build2ContainsPreBuildHookRunMessage = results2.includes('before-build hook test!');
      const build2ContainsPostBuildHookRunMessage = results2.includes('after-build hook test!');

      const build2ContainsPreBuildStepMessage = results2.includes('before-build step test!');
      const build2ContainsPostBuildStepMessage = results2.includes('after-build step test!');

      expect(build2ContainsBuildSucceeded).toBeTruthy();
      expect(build2ContainsPreBuildHookRunMessage).toBeTruthy();
      expect(build2ContainsPostBuildHookRunMessage).toBeTruthy();
      expect(build2ContainsPreBuildStepMessage).toBeTruthy();
      expect(build2ContainsPostBuildStepMessage).toBeTruthy();
    }, 1_000_000_000);
  }
});
