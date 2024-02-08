import CloudRunner from '../../cloud-runner';
import { ImageTag } from '../../..';
import UnityVersioning from '../../../unity-versioning';
import CloudRunnerLogger from '../../services/core/cloud-runner-logger';
import { v4 as uuidv4 } from 'uuid';
import CloudRunnerOptions from '../../options/cloud-runner-options';
import setups from './../cloud-runner-suite.test';
import * as fs from 'node:fs';
import path from 'node:path';
import { CloudRunnerFolders } from '../../options/cloud-runner-folders';
import SharedWorkspaceLocking from '../../services/core/shared-workspace-locking';
import { CreateParameters } from '../create-test-parameter';
import { CloudRunnerSystem } from '../../services/core/cloud-runner-system';

describe('Cloud Runner Retain Workspace', () => {
  it('Responds', () => {});
  setups();
  if (CloudRunnerOptions.cloudRunnerDebug) {
    it('Run one build it should not already be retained, run subsequent build which should use retained workspace', async () => {
      const overrides = {
        versioning: 'None',
        projectPath: 'test-project',
        unityVersion: UnityVersioning.determineUnityVersion('test-project', UnityVersioning.read('test-project')),
        targetPlatform: 'StandaloneLinux64',
        cacheKey: `test-case-${uuidv4()}`,
        maxRetainedWorkspaces: 1,
      };
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

      if (CloudRunnerOptions.providerStrategy === `local-docker`) {
        const cacheFolderExists = fs.existsSync(`cloud-runner-cache/cache/${overrides.cacheKey}`);
        expect(cacheFolderExists).toBeTruthy();
        await CloudRunnerSystem.Run(`tree -d ./cloud-runner-cache`);
      }

      CloudRunnerLogger.log(`run 1 succeeded`);

      // await CloudRunnerSystem.Run(`tree -d ./cloud-runner-cache/${}`);
      const buildParameter2 = await CreateParameters(overrides);

      buildParameter2.cacheKey = buildParameter.cacheKey;
      const baseImage2 = new ImageTag(buildParameter2);
      const results2Object = await CloudRunner.run(buildParameter2, baseImage2.toString());
      const results2 = results2Object.BuildResults;
      CloudRunnerLogger.log(`run 2 succeeded`);

      const build2ContainsCacheKey = results2.includes(buildParameter.cacheKey);
      const build2ContainsBuildGuid1FromRetainedWorkspace = results2.includes(buildParameter.buildGuid);
      const build2ContainsRetainedWorkspacePhrase = results2.includes(`Retained Workspace:`);
      const build2ContainsWorkspaceExistsAlreadyPhrase = results2.includes(`Retained Workspace Already Exists!`);
      const build2ContainsBuildSucceeded = results2.includes(buildSucceededString);
      const build2NotContainsZeroLibraryCacheFilesMessage = !results2.includes(
        'There is 0 files/dir in the cache pulled contents for Library',
      );
      const build2NotContainsZeroLFSCacheFilesMessage = !results2.includes(
        'There is 0 files/dir in the cache pulled contents for LFS',
      );

      expect(build2ContainsCacheKey).toBeTruthy();
      expect(build2ContainsRetainedWorkspacePhrase).toBeTruthy();
      expect(build2ContainsWorkspaceExistsAlreadyPhrase).toBeTruthy();
      expect(build2ContainsBuildGuid1FromRetainedWorkspace).toBeTruthy();
      expect(build2ContainsBuildSucceeded).toBeTruthy();
      expect(build2NotContainsZeroLibraryCacheFilesMessage).toBeTruthy();
      expect(build2NotContainsZeroLFSCacheFilesMessage).toBeTruthy();
      const splitResults = results2.split('Activation successful');
      expect(splitResults[splitResults.length - 1]).not.toContain(libraryString);
    }, 1_000_000_000);
    afterAll(async () => {
      await SharedWorkspaceLocking.CleanupWorkspace(CloudRunner.lockedWorkspace || ``, CloudRunner.buildParameters);
      if (
        fs.existsSync(`./cloud-runner-cache/${path.basename(CloudRunnerFolders.uniqueCloudRunnerJobFolderAbsolute)}`)
      ) {
        CloudRunnerLogger.log(
          `Cleaning up ./cloud-runner-cache/${path.basename(CloudRunnerFolders.uniqueCloudRunnerJobFolderAbsolute)}`,
        );
      }
    });
  }
});
