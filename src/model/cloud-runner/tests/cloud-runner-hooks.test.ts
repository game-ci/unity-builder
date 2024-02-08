import CloudRunner from '../cloud-runner';
import { BuildParameters, ImageTag } from '../..';
import UnityVersioning from '../../unity-versioning';
import { Cli } from '../../cli/cli';
import CloudRunnerLogger from '../services/core/cloud-runner-logger';
import { v4 as uuidv4 } from 'uuid';
import CloudRunnerOptions from '../options/cloud-runner-options';
import setups from './cloud-runner-suite.test';
import { ContainerHookService } from '../services/hooks/container-hook-service';
import { CommandHookService } from '../services/hooks/command-hook-service';

async function CreateParameters(overrides: any) {
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
      image: 'ubuntu',
      cacheKey: `test-case-${uuidv4()}`,
    };
    CloudRunner.setup(await CreateParameters(overrides));
    const stringObject = ContainerHookService.ParseContainerHooks(yamlString);
    const stringObject2 = ContainerHookService.ParseContainerHooks(yamlString2);

    CloudRunnerLogger.log(yamlString);
    CloudRunnerLogger.log(JSON.stringify(stringObject, undefined, 4));

    expect(stringObject.length).toBe(1);
    expect(stringObject[0].hook).toBe(`before`);
    expect(stringObject2.length).toBe(1);
    expect(stringObject2[0].hook).toBe(`before`);

    const getCustomStepsFromFiles = ContainerHookService.GetContainerHooksFromFiles(`before`);
    CloudRunnerLogger.log(JSON.stringify(getCustomStepsFromFiles, undefined, 4));
  });
  if (CloudRunnerOptions.cloudRunnerDebug && CloudRunnerOptions.providerStrategy !== `k8s`) {
    it('Should be 1 before and 1 after hook', async () => {
      const overrides = {
        versioning: 'None',
        image: 'ubuntu',
        projectPath: 'test-project',
        unityVersion: UnityVersioning.determineUnityVersion('test-project', UnityVersioning.read('test-project')),
        targetPlatform: 'StandaloneLinux64',
        cacheKey: `test-case-${uuidv4()}`,
        containerHookFiles: `my-test-step-pre-build,my-test-step-post-build`,
        commandHookFiles: `my-test-hook-pre-build,my-test-hook-post-build`,
      };
      const buildParameter2 = await CreateParameters(overrides);
      await CloudRunner.setup(buildParameter2);
      const beforeHooks = CommandHookService.GetCustomHooksFromFiles(`before`);
      const afterHooks = CommandHookService.GetCustomHooksFromFiles(`after`);
      expect(beforeHooks).toHaveLength(1);
      expect(afterHooks).toHaveLength(1);
    });
    it('Should be 1 before and 1 after step', async () => {
      const overrides = {
        versioning: 'None',
        projectPath: 'test-project',
        unityVersion: UnityVersioning.determineUnityVersion('test-project', UnityVersioning.read('test-project')),
        targetPlatform: 'StandaloneLinux64',
        cacheKey: `test-case-${uuidv4()}`,
        image: 'ubuntu',
        containerHookFiles: `my-test-step-pre-build,my-test-step-post-build`,
        commandHookFiles: `my-test-hook-pre-build,my-test-hook-post-build`,
      };
      const buildParameter2 = await CreateParameters(overrides);
      await CloudRunner.setup(buildParameter2);
      const beforeSteps = ContainerHookService.GetContainerHooksFromFiles(`before`);
      const afterSteps = ContainerHookService.GetContainerHooksFromFiles(`after`);
      expect(beforeSteps).toHaveLength(1);
      expect(afterSteps).toHaveLength(1);
    });
    it('Run build once - check for pre and post custom hooks run contents', async () => {
      const overrides = {
        versioning: 'None',
        projectPath: 'test-project',
        unityVersion: UnityVersioning.determineUnityVersion('test-project', UnityVersioning.read('test-project')),
        targetPlatform: 'StandaloneLinux64',
        cacheKey: `test-case-${uuidv4()}`,
        containerHookFiles: `my-test-step-pre-build,my-test-step-post-build`,
        commandHookFiles: `my-test-hook-pre-build,my-test-hook-post-build`,
      };
      const buildParameter2 = await CreateParameters(overrides);
      const baseImage2 = new ImageTag(buildParameter2);
      const results2Object = await CloudRunner.run(buildParameter2, baseImage2.toString());
      const results2 = results2Object.BuildResults;
      CloudRunnerLogger.log(`run 2 succeeded`);

      const buildContainsBuildSucceeded = results2.includes('Build succeeded');
      const buildContainsPreBuildHookRunMessage = results2.includes('before-build hook test!');
      const buildContainsPostBuildHookRunMessage = results2.includes('after-build hook test!');

      const buildContainsPreBuildStepMessage = results2.includes('before-build step test!');
      const buildContainsPostBuildStepMessage = results2.includes('after-build step test!');

      expect(buildContainsBuildSucceeded).toBeTruthy();
      expect(buildContainsPreBuildHookRunMessage).toBeTruthy();
      expect(buildContainsPostBuildHookRunMessage).toBeTruthy();
      expect(buildContainsPreBuildStepMessage).toBeTruthy();
      expect(buildContainsPostBuildStepMessage).toBeTruthy();
    }, 1_000_000_000);
  }
});
