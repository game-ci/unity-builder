import { assert } from 'console';
import fs from 'fs';
import path from 'path';
import { Input } from '../..';
import { CloudRunnerState } from '../../cloud-runner/state/cloud-runner-state';
import { CloudRunnerAgentSystem } from './cloud-runner-agent-system';
import { RemoteClientLogger } from './remote-client-logger';

export class Caching {
  public static async PushToCache(cacheFolder: string, destinationFolder: string, artifactName: string) {
    try {
      process.chdir(`${destinationFolder}/..`);
      await CloudRunnerAgentSystem.Run(`zip -r "${artifactName}.zip" "${path.dirname(destinationFolder)}"`);
      assert(fs.existsSync(`${artifactName}.zip`));
      await CloudRunnerAgentSystem.Run(`cp "${artifactName}.zip" "${path.join(cacheFolder, `${artifactName}.zip`)}"`);
      RemoteClientLogger.log(`copied ${artifactName} to ${cacheFolder}`);
    } catch (error) {
      throw error;
    }
  }
  public static async PullFromCache(cacheFolder: string, destinationFolder: string, specificHashMatch: string = ``) {
    try {
      if (!fs.existsSync(cacheFolder)) {
        await CloudRunnerAgentSystem.Run(`mkdir -p ${cacheFolder}`);
      }

      if (!fs.existsSync(destinationFolder)) {
        await CloudRunnerAgentSystem.Run(`mkdir -p ${destinationFolder}`);
      }

      const latest = await (await CloudRunnerAgentSystem.Run(`ls -t "${cacheFolder}" | grep .zip$ | head -1`)).replace(
        /\n/g,
        ``,
      );

      process.chdir(cacheFolder);
      let cacheSelection;

      if (specificHashMatch !== ``) {
        cacheSelection = fs.existsSync(specificHashMatch) ? specificHashMatch : latest;
      } else {
        cacheSelection = latest;
      }
      if (fs.existsSync(cacheSelection)) {
        if (Input.cloudRunnerTests) {
          await CloudRunnerAgentSystem.Run(`tree ${destinationFolder}`);
        }
        RemoteClientLogger.log(`cache item exists`);
        assert(fs.existsSync(destinationFolder));
        await CloudRunnerAgentSystem.Run(`unzip "${cacheSelection}" -d "${destinationFolder}/.."`);
      } else {
        RemoteClientLogger.logWarning(`cache item ${specificHashMatch} doesn't exist ${destinationFolder}`);
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

  public static async printCacheState(lfsCacheFolder: string, libraryCacheFolder: string) {
    await CloudRunnerAgentSystem.Run(
      `echo ' '
      echo "LFS cache for $branch"
      du -sch "${lfsCacheFolder}/"
      echo '**'
      echo "Library cache for $branch"
      du -sch "${libraryCacheFolder}/"
      echo '**'
      echo "Branch: $branch"
      du -sch "${CloudRunnerState.cacheFolderFull}/"
      echo '**'
      echo 'Full cache'
      du -sch "${CloudRunnerState.cacheFolderFull}/"
      echo ' '`,
    );
  }
}
