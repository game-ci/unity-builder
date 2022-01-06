import { assert } from 'console';
import fs from 'fs';
import path from 'path';
import { Input } from '../../..';
import CloudRunnerLogger from '../../../cloud-runner/services/cloud-runner-logger';
import { CloudRunnerState } from '../../../cloud-runner/state/cloud-runner-state';
import { CloudRunnerSystem } from './cloud-runner-system';
import { LFSHashing } from './lfs-hashing';
import { RemoteClientLogger } from './remote-client-logger';

export class Caching {
  public static async PushToCache(cacheFolder: string, sourceFolder: string, cacheKey: string) {
    try {
      if (!fs.existsSync(cacheFolder)) {
        await CloudRunnerSystem.Run(`mkdir -p ${cacheFolder}`);
      }

      if (Input.cloudRunnerTests) {
        await Caching.printFullCacheHierarchySize();
      }
      process.chdir(sourceFolder);

      if (Input.cloudRunnerTests) {
        CloudRunnerLogger.log(`Hashed cache folder ${await LFSHashing.hashAllFiles(sourceFolder)} ${sourceFolder}`);
      }

      if (Input.cloudRunnerTests) {
        await CloudRunnerSystem.Run(`ls`);
      }
      assert(fs.existsSync(`${path.basename(sourceFolder)}`));

      await CloudRunnerSystem.Run(
        `zip${Input.cloudRunnerTests ? '' : ' -q'} -r ${cacheKey}.zip ./../${path.basename(sourceFolder)}`,
      );
      assert(fs.existsSync(`${cacheKey}.zip`));
      assert(fs.existsSync(`${cacheFolder}`));
      assert(fs.existsSync(`${path.basename(sourceFolder)}`));
      await CloudRunnerSystem.Run(`mv ${cacheKey}.zip ${cacheFolder}`);
      RemoteClientLogger.log(`moved ${cacheKey}.zip to ${cacheFolder}`);
      assert(fs.existsSync(`${path.join(cacheFolder, cacheKey)}.zip`));

      if (Input.cloudRunnerTests) {
        await Caching.printFullCacheHierarchySize();
      }
    } catch (error) {
      throw error;
    }
  }
  public static async PullFromCache(cacheFolder: string, destinationFolder: string, cacheKey: string = ``) {
    RemoteClientLogger.log(`Caching for ${path.basename(destinationFolder)}`);
    try {
      if (!fs.existsSync(cacheFolder)) {
        await CloudRunnerSystem.Run(`mkdir -p ${cacheFolder}`);
      }

      if (!fs.existsSync(destinationFolder)) {
        await CloudRunnerSystem.Run(`mkdir -p ${destinationFolder}`);
      }

      const latestInBranch = await (await CloudRunnerSystem.Run(`ls -t "${cacheFolder}" | grep .zip$ | head -1`))
        .replace(/\n/g, ``)
        .replace('.zip', '');

      process.chdir(cacheFolder);

      const cacheSelection = cacheKey !== `` && fs.existsSync(`${cacheKey}.zip`) ? cacheKey : latestInBranch;
      await CloudRunnerLogger.log(`cache key ${cacheKey} selection ${cacheSelection}`);

      if (fs.existsSync(`${cacheSelection}.zip`)) {
        if (Input.cloudRunnerTests) {
          await CloudRunnerSystem.Run(`tree ${destinationFolder}`);
        }
        RemoteClientLogger.log(`cache item exists`);
        assert(fs.existsSync(destinationFolder));
        await CloudRunnerSystem.Run(`unzip -q ${cacheSelection}.zip -d ${path.basename(destinationFolder)}`);
        await CloudRunnerSystem.Run(`mv ${path.basename(destinationFolder)}/* ${destinationFolder}`);
        assert(fs.existsSync(`${path.join(destinationFolder, `${cacheSelection}.zip`)}`));
      } else {
        RemoteClientLogger.logWarning(`cache item ${cacheKey} doesn't exist ${destinationFolder}`);
        if (cacheSelection !== ``) {
          if (Input.cloudRunnerTests) {
            await CloudRunnerSystem.Run(`tree ${cacheFolder}`);
          }
          RemoteClientLogger.logWarning(`cache item ${cacheKey}.zip doesn't exist ${destinationFolder}`);
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
    await CloudRunnerSystem.Run(
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
      du -sch "${CloudRunnerState.cacheFolderFull}/../"
      echo ' '`,
    );
  }
}
