import CloudRunner from '../../cloud-runner';
import { BuildParameters, ImageTag } from '../../..';
import UnityVersioning from '../../../unity-versioning';
import { Cli } from '../../../cli/cli';
import CloudRunnerLogger from '../../services/core/cloud-runner-logger';
import { v4 as uuidv4 } from 'uuid';
import CloudRunnerOptions from '../../options/cloud-runner-options';
import setups from '../cloud-runner-suite.test';
import * as fs from 'node:fs';
import { CloudRunnerSystem } from '../../services/core/cloud-runner-system';

async function CreateParameters(overrides: any) {
  if (overrides) {
    Cli.options = overrides;
  }

  return await BuildParameters.create();
}

describe('Cloud Runner Caching', () => {
  it('Responds', () => {});
  setups();
  if (CloudRunnerOptions.cloudRunnerDebug) {
    it('Run one build it should not use cache, run subsequent build which should use cache', async () => {
      const overrides = {
        versioning: 'None',
        image: 'ubuntu',
        projectPath: 'test-project',
        unityVersion: UnityVersioning.determineUnityVersion('test-project', UnityVersioning.read('test-project')),
        targetPlatform: 'StandaloneLinux64',
        cacheKey: `test-case-${uuidv4()}`,
        containerHookFiles: `debug-cache`,
        cloudRunnerBranch: `cloud-runner-develop`,
      };
      if (CloudRunnerOptions.providerStrategy === `k8s`) {
        overrides.containerHookFiles += `,aws-s3-pull-cache,aws-s3-upload-cache`;
      }
      const buildParameter = await CreateParameters(overrides);
      expect(buildParameter.projectPath).toEqual(overrides.projectPath);

      const baseImage = new ImageTag(buildParameter);
      const resultsObject = await CloudRunner.run(buildParameter, baseImage.toString());
      const results = resultsObject.BuildResults;
      const libraryString = 'Rebuilding Library because the asset database could not be found!';
      const cachePushFail = 'Did not push source folder to cache because it was empty Library';
      const buildSucceededString = 'Build succeeded';

      expect(results).toContain(libraryString);
      expect(results).toContain(buildSucceededString);
      expect(results).not.toContain(cachePushFail);

      CloudRunnerLogger.log(`run 1 succeeded`);

      if (CloudRunnerOptions.providerStrategy === `local-docker`) {
        await CloudRunnerSystem.Run(`tree ./cloud-runner-cache/cache`);
        await CloudRunnerSystem.Run(
          `cp ./cloud-runner-cache/cache/${buildParameter.cacheKey}/Library/lib-${buildParameter.buildGuid}.tar ./`,
        );
        await CloudRunnerSystem.Run(`mkdir results`);
        await CloudRunnerSystem.Run(`tar -xf lib-${buildParameter.buildGuid}.tar -C ./results`);
        await CloudRunnerSystem.Run(`tree -d ./results`);
        const cacheFolderExists = fs.existsSync(`cloud-runner-cache/cache/${overrides.cacheKey}`);
        expect(cacheFolderExists).toBeTruthy();
      }
      const buildParameter2 = await CreateParameters(overrides);

      buildParameter2.cacheKey = buildParameter.cacheKey;
      const baseImage2 = new ImageTag(buildParameter2);
      const results2Object = await CloudRunner.run(buildParameter2, baseImage2.toString());
      const results2 = results2Object.BuildResults;
      CloudRunnerLogger.log(`run 2 succeeded`);

      const build2ContainsCacheKey = results2.includes(buildParameter.cacheKey);
      const build2ContainsBuildSucceeded = results2.includes(buildSucceededString);
      const build2NotContainsZeroLibraryCacheFilesMessage = !results2.includes(
        'There is 0 files/dir in the cache pulled contents for Library',
      );
      const build2NotContainsZeroLFSCacheFilesMessage = !results2.includes(
        'There is 0 files/dir in the cache pulled contents for LFS',
      );

      expect(build2ContainsCacheKey).toBeTruthy();
      expect(results2).toContain('Activation successful');
      expect(build2ContainsBuildSucceeded).toBeTruthy();
      expect(results2).toContain(buildSucceededString);
      const splitResults = results2.split('Activation successful');
      expect(splitResults[splitResults.length - 1]).not.toContain(libraryString);
      expect(build2NotContainsZeroLibraryCacheFilesMessage).toBeTruthy();
      expect(build2NotContainsZeroLFSCacheFilesMessage).toBeTruthy();
    }, 1_000_000_000);
  }
});
