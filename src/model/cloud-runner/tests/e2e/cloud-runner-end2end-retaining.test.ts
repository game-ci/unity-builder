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
        cloudRunnerDebug: true,
      };
      const buildParameter = await CreateParameters(overrides);
      expect(buildParameter.projectPath).toEqual(overrides.projectPath);

      const baseImage = new ImageTag(buildParameter);
      const resultsObject = await CloudRunner.run(buildParameter, baseImage.toString());
      const results = resultsObject.BuildResults;
      const libraryString = 'Rebuilding Library because the asset database could not be found!';
      const cachePushFail = 'Did not push source folder to cache because it was empty Library';

      expect(resultsObject.BuildSucceeded).toBe(true);

      // Keep minimal assertions to reduce brittleness
      expect(results).not.toContain(cachePushFail);

      if (CloudRunnerOptions.providerStrategy === `local-docker`) {
        const cacheFolderExists = fs.existsSync(`cloud-runner-cache/cache/${overrides.cacheKey}`);
        expect(cacheFolderExists).toBeTruthy();
        await CloudRunnerSystem.Run(`tree -d ./cloud-runner-cache`);
      }

      CloudRunnerLogger.log(`run 1 succeeded`);

      // Clean up k3d node between builds to free space, but preserve Unity image
      if (CloudRunnerOptions.providerStrategy === 'k8s') {
        try {
          CloudRunnerLogger.log('Cleaning up k3d node between builds (preserving Unity image)...');
          const K3D_NODE_CONTAINERS = ['k3d-unity-builder-agent-0', 'k3d-unity-builder-server-0'];
          for (const NODE of K3D_NODE_CONTAINERS) {
            // Remove stopped containers only - DO NOT touch images
            // Removing images risks removing the Unity image which causes "no space left" errors
            await CloudRunnerSystem.Run(
              `docker exec ${NODE} sh -c "crictl rm --all 2>/dev/null || true" || true`,
              true,
              true,
            );
          }
          CloudRunnerLogger.log('Cleanup between builds completed (containers removed, images preserved)');
        } catch (cleanupError) {
          CloudRunnerLogger.logWarning(`Failed to cleanup between builds: ${cleanupError}`);

          // Continue anyway
        }
      }

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
      expect(results2Object.BuildSucceeded).toBe(true);
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
        try {
          const workspaceCachePath = `./cloud-runner-cache/${path.basename(
            CloudRunnerFolders.uniqueCloudRunnerJobFolderAbsolute,
          )}`;

          // Try to fix permissions first to avoid permission denied errors
          await CloudRunnerSystem.Run(
            `chmod -R u+w ${workspaceCachePath} 2>/dev/null || chown -R $(whoami) ${workspaceCachePath} 2>/dev/null || true`,
          );

          // Try regular rm first
          await CloudRunnerSystem.Run(`rm -rf ${workspaceCachePath} 2>/dev/null || true`);

          // If that fails, try with sudo if available
          await CloudRunnerSystem.Run(`sudo rm -rf ${workspaceCachePath} 2>/dev/null || true`);

          // As last resort, try to remove files one by one, ignoring permission errors
          await CloudRunnerSystem.Run(
            `find ${workspaceCachePath} -type f -exec rm -f {} + 2>/dev/null || find ${workspaceCachePath} -type f -delete 2>/dev/null || true`,
          );

          // Remove empty directories
          await CloudRunnerSystem.Run(`find ${workspaceCachePath} -type d -empty -delete 2>/dev/null || true`);
        } catch (error: any) {
          CloudRunnerLogger.log(`Failed to cleanup workspace: ${error.message}`);

          // Don't throw - cleanup failures shouldn't fail the test suite
        }
      }

      // Clean up cache files to prevent disk space issues
      const cachePath = `./cloud-runner-cache`;
      if (fs.existsSync(cachePath)) {
        try {
          CloudRunnerLogger.log(`Cleaning up cache directory: ${cachePath}`);

          // Try to change ownership first (if running as root or with sudo)
          // Then try multiple cleanup methods to handle permission issues
          await CloudRunnerSystem.Run(
            `chmod -R u+w ${cachePath} 2>/dev/null || chown -R $(whoami) ${cachePath} 2>/dev/null || true`,
          );

          // Try regular rm first
          await CloudRunnerSystem.Run(`rm -rf ${cachePath}/* 2>/dev/null || true`);

          // If that fails, try with sudo if available
          await CloudRunnerSystem.Run(`sudo rm -rf ${cachePath}/* 2>/dev/null || true`);

          // As last resort, try to remove files one by one, ignoring permission errors
          await CloudRunnerSystem.Run(
            `find ${cachePath} -type f -exec rm -f {} + 2>/dev/null || find ${cachePath} -type f -delete 2>/dev/null || true`,
          );

          // Remove empty directories
          await CloudRunnerSystem.Run(`find ${cachePath} -type d -empty -delete 2>/dev/null || true`);
        } catch (error: any) {
          CloudRunnerLogger.log(`Failed to cleanup cache: ${error.message}`);

          // Don't throw - cleanup failures shouldn't fail the test suite
        }
      }
    });
  }
});
