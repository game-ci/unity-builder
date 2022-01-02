import { assert } from 'console';
import fs from 'fs';
import path from 'path';
import { Input } from '../..';
import CloudRunnerLogger from '../../cloud-runner/services/cloud-runner-logger';
import { CloudRunnerState } from '../../cloud-runner/state/cloud-runner-state';
import { CloudRunnerAgentSystem } from './cloud-runner-agent-system';
import { LFSHashing } from './lfs-hashing';
import { RemoteClientLogger } from './remote-client-logger';

export class Caching {
  public static async PushToCache(cacheFolder: string, sourceFolder: string, cacheKey: string) {
    try {
      if (Input.cloudRunnerTests) {
        await Caching.printFullCacheHierarchySize();
      }
      process.chdir(`${sourceFolder}/..`);

      if (Input.cloudRunnerTests) {
        CloudRunnerLogger.log(`Hashed cache folder ${await LFSHashing.hashAllFiles(sourceFolder)}`);
        await CloudRunnerAgentSystem.Run(`tree ${sourceFolder}`);
        await CloudRunnerAgentSystem.Run(`tree ${cacheFolder}`);
      }
      await CloudRunnerAgentSystem.Run(`zip -r "${cacheKey}.zip" "${path.dirname(sourceFolder)}"`);
      assert(fs.existsSync(`${cacheKey}.zip`));
      await CloudRunnerAgentSystem.Run(`cp "${cacheKey}.zip" "${path.join(cacheFolder, `${cacheKey}.zip`)}"`);
      RemoteClientLogger.log(`copied ${cacheKey} to ${cacheFolder}`);

      if (Input.cloudRunnerTests) {
        await CloudRunnerAgentSystem.Run(`tree ${cacheFolder}`);
      }
      if (Input.cloudRunnerTests) {
        await Caching.printFullCacheHierarchySize();
      }
    } catch (error) {
      throw error;
    }
  }
  public static async PullFromCache(cacheFolder: string, destinationFolder: string, cacheKey: string = ``) {
    RemoteClientLogger.log(`Caching for ${path.dirname(destinationFolder)}`);
    try {
      if (!fs.existsSync(cacheFolder)) {
        await CloudRunnerAgentSystem.Run(`mkdir -p ${cacheFolder}`);
      }

      if (!fs.existsSync(destinationFolder)) {
        await CloudRunnerAgentSystem.Run(`mkdir -p ${destinationFolder}`);
      }

      const latestInBranch = await (
        await CloudRunnerAgentSystem.Run(`ls -t "${cacheFolder}" | grep .zip$ | head -1`)
      ).replace(/\n/g, ``);

      process.chdir(cacheFolder);

      if (Input.cloudRunnerTests) {
        await CloudRunnerAgentSystem.Run(`tree ${cacheFolder}`);
      }

      const cacheSelection = cacheKey !== `` && fs.existsSync(cacheKey) ? cacheKey : latestInBranch;

      if (Input.cloudRunnerTests) {
        await CloudRunnerLogger.log(`cache key ${cacheKey} selection ${cacheSelection}`);
      }

      if (fs.existsSync(cacheSelection)) {
        if (Input.cloudRunnerTests) {
          await CloudRunnerAgentSystem.Run(`tree ${destinationFolder}`);
        }
        RemoteClientLogger.log(`cache item exists`);
        assert(fs.existsSync(destinationFolder));
        await CloudRunnerAgentSystem.Run(`unzip "${cacheSelection}" -d "${path.dirname(destinationFolder)}"`);
        await CloudRunnerAgentSystem.Run(`cp -r "${cacheSelection}" "${destinationFolder}/..""`);
        if (Input.cloudRunnerTests) {
          await CloudRunnerAgentSystem.Run(`tree ${destinationFolder}`);
        }
      } else {
        RemoteClientLogger.logWarning(`cache item ${cacheKey} doesn't exist ${destinationFolder}`);
        if (cacheSelection !== ``) {
          throw new Error(`Failed to get cache item, but cache hit was found: ${cacheSelection}`);
        }
      }
    } catch (error) {
      throw error;
    }
  }

  public static handleCachePurging() {
    if (process.env.purgeRemoteCaching !== undefined) {
      RemoteClientLogger.log(`purging ${CloudRunnerState.purgeRemoteCaching}`);
      fs.rmdirSync(CloudRunnerState.cacheFolder, { recursive: true });
    }
  }

  public static async printFullCacheHierarchySize() {
    await CloudRunnerAgentSystem.Run(
      `echo ' '
      echo "LFS cache for $branch"
      du -sch "${CloudRunnerState.lfsCacheFolderFull}/"
      echo '**'
      echo "Library cache for $branch"
      du -sch "${CloudRunnerState.libraryCacheFolderFull}/"
      echo '**'
      echo "Branch: $branch"
      du -sch "${CloudRunnerState.cacheFolderFull}/"
      echo '**'
      echo 'Full cache'
      du -sch "${CloudRunnerState.cacheFolderFull}/.."
      echo ' '`,
    );
  }
}
