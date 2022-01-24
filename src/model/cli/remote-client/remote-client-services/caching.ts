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
    const startPath = process.cwd();
    try {
      if (!fs.existsSync(cacheFolder)) {
        await CloudRunnerSystem.Run(`mkdir -p ${cacheFolder}`);
      }
      process.chdir(path.resolve(sourceFolder, '..'));

      if (Input.cloudRunnerTests) {
        CloudRunnerLogger.log(
          `Hashed cache folder ${await LFSHashing.hashAllFiles(sourceFolder)} ${sourceFolder} ${path.basename(
            sourceFolder,
          )}`,
        );
      }

      if (Input.cloudRunnerTests) {
        await CloudRunnerSystem.Run(`ls ${path.basename(sourceFolder)}`);
      }
      await CloudRunnerSystem.Run(`zip ${cacheKey}.zip ${path.basename(sourceFolder)}`);
      assert(fs.existsSync(`${cacheKey}.zip`), 'cache zip exists');
      assert(fs.existsSync(path.basename(sourceFolder)), 'source folder exists');
      await CloudRunnerSystem.Run(`mv ${cacheKey} ${cacheFolder}`);
      RemoteClientLogger.log(`moved ${cacheKey}.zip to ${cacheFolder}`);
      assert(fs.existsSync(`${path.join(cacheFolder, cacheKey)}.zip`), 'cache zip exists inside cache folder');
    } catch (error) {
      process.chdir(`${startPath}`);
      throw error;
    }
    process.chdir(`${startPath}`);
  }
  public static async PullFromCache(cacheFolder: string, destinationFolder: string, cacheKey: string = ``) {
    const startPath = process.cwd();
    RemoteClientLogger.log(`Caching for ${path.basename(destinationFolder)}`);
    try {
      if (!fs.existsSync(cacheFolder)) {
        fs.mkdirSync(cacheFolder);
      }

      if (!fs.existsSync(destinationFolder)) {
        fs.mkdirSync(destinationFolder);
      }

      const latestInBranch = await (await CloudRunnerSystem.Run(`ls -t "${cacheFolder}" | grep .zip$ | head -1`))
        .replace(/\n/g, ``)
        .replace('.zip', '');

      process.chdir(cacheFolder);

      const cacheSelection = cacheKey !== `` && fs.existsSync(`${cacheKey}.zip`) ? cacheKey : latestInBranch;
      await CloudRunnerLogger.log(`cache key ${cacheKey} selection ${cacheSelection}`);

      if (fs.existsSync(`${cacheSelection}.zip`)) {
        const resultsFolder = `results${CloudRunnerState.buildParams.buildGuid}`;
        await CloudRunnerSystem.Run(`mkdir -p ${resultsFolder}`);
        if (Input.cloudRunnerTests) {
          await CloudRunnerSystem.Run(`tree ${destinationFolder}`);
        }
        RemoteClientLogger.log(`cache item exists ${cacheFolder}/${cacheSelection}.zip`);
        assert(`${fs.existsSync(destinationFolder)}`);
        assert(`${fs.existsSync(`${cacheSelection}.zip`)}`);
        const fullDestination = path.join(cacheFolder, resultsFolder);
        if (Input.cloudRunnerTests) {
          await CloudRunnerSystem.Run(`tree ${cacheFolder}`);
        }
        await CloudRunnerSystem.Run(`unzip ${cacheSelection}.zip -d ${path.basename(resultsFolder)}`);
        RemoteClientLogger.log(`cache item extracted to ${fullDestination}`);
        assert(`${fs.existsSync(fullDestination)}`);
        const destinationParentFolder = path.resolve(destinationFolder, '..');
        await CloudRunnerSystem.Run(`mv "${fullDestination}" "${destinationParentFolder}"`);
        if (fs.existsSync(destinationFolder)) {
          fs.rmSync(destinationFolder, { recursive: true, force: true });
        }
        fs.renameSync(path.resolve(destinationParentFolder, resultsFolder), destinationFolder);
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
      process.chdir(`${startPath}`);
      throw error;
    }
    process.chdir(`${startPath}`);
  }

  public static handleCachePurging() {
    if (process.env.PURGE_REMOTE_BUILDER_CACHE !== undefined) {
      RemoteClientLogger.log(`purging ${CloudRunnerState.purgeRemoteCaching}`);
      fs.rmdirSync(CloudRunnerState.cacheFolder, { recursive: true });
    }
  }
}
