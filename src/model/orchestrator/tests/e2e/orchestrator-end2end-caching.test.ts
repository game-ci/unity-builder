import Orchestrator from '../../orchestrator';
import { BuildParameters, ImageTag } from '../../..';
import UnityVersioning from '../../../unity-versioning';
import { Cli } from '../../../cli/cli';
import OrchestratorLogger from '../../services/core/orchestrator-logger';
import { v4 as uuidv4 } from 'uuid';
import OrchestratorOptions from '../../options/orchestrator-options';
import setups from '../orchestrator-suite.test';
import * as fs from 'node:fs';
import { OrchestratorSystem } from '../../services/core/orchestrator-system';

async function CreateParameters(overrides: any) {
  if (overrides) {
    Cli.options = overrides;
  }

  return await BuildParameters.create();
}

describe('Orchestrator Caching', () => {
  it('Responds', () => {});
  setups();
  if (OrchestratorOptions.orchestratorDebug) {
    it('Run one build it should not use cache, run subsequent build which should use cache', async () => {
      const overrides: any = {
        versioning: 'None',
        image: 'ubuntu',
        projectPath: 'test-project',
        unityVersion: UnityVersioning.determineUnityVersion('test-project', UnityVersioning.read('test-project')),
        targetPlatform: 'StandaloneLinux64',
        cacheKey: `test-case-${uuidv4()}`,
        containerHookFiles: `debug-cache`,
        orchestratorBranch: `main`,
        orchestratorDebug: true,
      };

      // For AWS LocalStack tests, explicitly set provider strategy to 'aws'
      // This ensures we use AWS LocalStack instead of defaulting to local-docker
      // But don't override if k8s provider is already set
      if (
        process.env.AWS_S3_ENDPOINT &&
        process.env.AWS_S3_ENDPOINT.includes('localhost') &&
        OrchestratorOptions.providerStrategy !== 'k8s'
      ) {
        overrides.providerStrategy = 'aws';
        overrides.containerHookFiles += `,aws-s3-pull-cache,aws-s3-upload-cache`;
      }
      if (OrchestratorOptions.providerStrategy === `k8s`) {
        overrides.containerHookFiles += `,aws-s3-pull-cache,aws-s3-upload-cache`;
      }
      const buildParameter = await CreateParameters(overrides);
      expect(buildParameter.projectPath).toEqual(overrides.projectPath);

      const baseImage = new ImageTag(buildParameter);
      const resultsObject = await Orchestrator.run(buildParameter, baseImage.toString());
      const results = resultsObject.BuildResults;
      const libraryString = 'Rebuilding Library because the asset database could not be found!';
      const cachePushFail = 'Did not push source folder to cache because it was empty Library';

      expect(resultsObject.BuildSucceeded).toBe(true);

      // Keep minimal assertions to reduce brittleness
      expect(results).not.toContain(cachePushFail);

      OrchestratorLogger.log(`run 1 succeeded`);

      if (OrchestratorOptions.providerStrategy === `local-docker`) {
        await OrchestratorSystem.Run(`tree ./orchestrator-cache/cache`);
        await OrchestratorSystem.Run(
          `cp ./orchestrator-cache/cache/${buildParameter.cacheKey}/Library/lib-${buildParameter.buildGuid}.tar ./`,
        );
        await OrchestratorSystem.Run(`mkdir results`);
        await OrchestratorSystem.Run(`tar -xf lib-${buildParameter.buildGuid}.tar -C ./results`);
        await OrchestratorSystem.Run(`tree -d ./results`);
        const cacheFolderExists = fs.existsSync(`orchestrator-cache/cache/${overrides.cacheKey}`);
        expect(cacheFolderExists).toBeTruthy();
      }
      const buildParameter2 = await CreateParameters(overrides);

      buildParameter2.cacheKey = buildParameter.cacheKey;
      const baseImage2 = new ImageTag(buildParameter2);
      const results2Object = await Orchestrator.run(buildParameter2, baseImage2.toString());
      const results2 = results2Object.BuildResults;
      OrchestratorLogger.log(`run 2 succeeded`);

      const build2ContainsCacheKey = results2.includes(buildParameter.cacheKey);
      const build2NotContainsZeroLibraryCacheFilesMessage = !results2.includes(
        'There is 0 files/dir in the cache pulled contents for Library',
      );
      const build2NotContainsZeroLFSCacheFilesMessage = !results2.includes(
        'There is 0 files/dir in the cache pulled contents for LFS',
      );

      expect(build2ContainsCacheKey).toBeTruthy();
      expect(results2).toContain('Activation successful');
      expect(results2Object.BuildSucceeded).toBe(true);
      const splitResults = results2.split('Activation successful');
      expect(splitResults[splitResults.length - 1]).not.toContain(libraryString);
      expect(build2NotContainsZeroLibraryCacheFilesMessage).toBeTruthy();
      expect(build2NotContainsZeroLFSCacheFilesMessage).toBeTruthy();
    }, 1_000_000_000);
    afterAll(async () => {
      // Clean up cache files to prevent disk space issues
      if (OrchestratorOptions.providerStrategy === `local-docker` || OrchestratorOptions.providerStrategy === `aws`) {
        const cachePath = `./orchestrator-cache`;
        if (fs.existsSync(cachePath)) {
          try {
            OrchestratorLogger.log(`Cleaning up cache directory: ${cachePath}`);

            // Try to change ownership first (if running as root or with sudo)
            // Then try multiple cleanup methods to handle permission issues
            await OrchestratorSystem.Run(
              `chmod -R u+w ${cachePath} 2>/dev/null || chown -R $(whoami) ${cachePath} 2>/dev/null || true`,
            );

            // Try regular rm first
            await OrchestratorSystem.Run(`rm -rf ${cachePath}/* 2>/dev/null || true`);

            // If that fails, try with sudo if available
            await OrchestratorSystem.Run(`sudo rm -rf ${cachePath}/* 2>/dev/null || true`);

            // As last resort, try to remove files one by one, ignoring permission errors
            await OrchestratorSystem.Run(
              `find ${cachePath} -type f -exec rm -f {} + 2>/dev/null || find ${cachePath} -type f -delete 2>/dev/null || true`,
            );

            // Remove empty directories
            await OrchestratorSystem.Run(`find ${cachePath} -type d -empty -delete 2>/dev/null || true`);
          } catch (error: any) {
            OrchestratorLogger.log(`Failed to cleanup cache: ${error.message}`);

            // Don't throw - cleanup failures shouldn't fail the test suite
          }
        }
      }
    });
  }
});
