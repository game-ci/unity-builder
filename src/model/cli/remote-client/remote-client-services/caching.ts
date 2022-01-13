import { assert } from 'console';
import fs from 'fs';
import path from 'path';
import { Input } from '../../..';
import CloudRunnerLogger from '../../../cloud-runner/services/cloud-runner-logger';
import { CloudRunnerState } from '../../../cloud-runner/state/cloud-runner-state';
import { CloudRunnerSystem } from './cloud-runner-system';
import { LFSHashing } from './lfs-hashing';
import { RemoteClientLogger } from './remote-client-logger';
import archiver from 'archiver';
import extract from 'extract-zip';

export class Caching {
  public static async PushToCache(cacheFolder: string, sourceFolder: string, cacheKey: string) {
    const startPath = process.cwd();
    try {
      if (!fs.existsSync(cacheFolder)) {
        await CloudRunnerSystem.Run(`mkdir -p ${cacheFolder}`);
      }
      process.chdir(`${sourceFolder}`);

      if (Input.cloudRunnerTests) {
        CloudRunnerLogger.log(
          `Hashed cache folder ${await LFSHashing.hashAllFiles(sourceFolder)} ${sourceFolder} ${path.basename(
            sourceFolder,
          )}`,
        );
      }

      if (Input.cloudRunnerTests) {
        await CloudRunnerSystem.Run(`ls`);
      }
      assert(fs.existsSync(`${path.basename(sourceFolder)}`));
      await new Promise<void>((resolve) => {
        const output = fs.createWriteStream(`${cacheKey}.zip`);
        const archive = archiver('zip', {
          zlib: { level: 9 }, // Sets the compression level.
        });
        output.on('close', function () {
          CloudRunnerLogger.log(`${archive.pointer()} total bytes`);
          CloudRunnerLogger.log('archiver has been finalized and the output file descriptor has closed.');
          resolve();
        });
        output.on('end', function () {
          CloudRunnerLogger.log('Data has been drained');
        });
        archive.on('warning', function (error) {
          if (error.code === 'ENOENT') {
            // log warning
            CloudRunnerLogger.logWarning(error);
          } else {
            throw error;
          }
        });
        archive.on('error', function (error) {
          throw error;
        });
        archive.pipe(output);
        archive.directory(sourceFolder, false);
        archive.finalize();
      });
      assert(fs.existsSync(`${cacheKey}.zip`), 'cache zip exists');
      assert(fs.existsSync(`${cacheFolder}`), 'cache folder');
      assert(fs.existsSync(path.resolve(`..`, `${path.basename(sourceFolder)}`)), 'source folder exists');
      await CloudRunnerSystem.Run(`mv ${cacheKey}.zip ${cacheFolder}`);
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
        RemoteClientLogger.log(`cache item exists ${cacheFolder}/${cacheSelection}.zip`);
        assert(`${fs.existsSync(destinationFolder)}`);
        assert(`${fs.existsSync(`${cacheSelection}.zip`)}`);
        const fullDestination = path.join(process.cwd(), path.basename(destinationFolder));
        if (Input.cloudRunnerTests) {
          await CloudRunnerSystem.Run(`tree ${cacheFolder}`);
        }
        await extract(`${cacheSelection}.zip`, { dir: process.cwd() });
        if (Input.cloudRunnerTests) {
          await CloudRunnerSystem.Run(`tree ${fullDestination}`);
        }
        RemoteClientLogger.log(`cache item extracted to ${fullDestination}`);
        assert(`${fs.existsSync(fullDestination)}`);
        await CloudRunnerSystem.Run(`mv "${fullDestination}" "${destinationFolder}"`);
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
