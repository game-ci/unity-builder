import { assert } from 'console';
import fs from 'fs';
import path from 'path';
import CloudRunnerLogger from '../../cloud-runner/services/cloud-runner-logger';
import { RemoteClientSystem } from './remote-client-system';

export class Caching {
  public static async PushToCache(cacheFolder: string, destinationFolder: string, artifactName: string) {
    process.chdir(`${destinationFolder}/..`);
    await RemoteClientSystem.Run(`zip -r "${artifactName}.zip" "${path.dirname(destinationFolder)}"`);
    assert(fs.existsSync(`${artifactName}.zip`));
    await RemoteClientSystem.Run(`cp "${artifactName}.zip" "${path.join(cacheFolder, `${artifactName}.zip`)}"`);
    CloudRunnerLogger.logCli(`copied ${artifactName} to ${cacheFolder}`);
  }
  public static async PullFromCache(cacheFolder: string, destinationFolder: string, specificHashMatch: string = ``) {
    if (!fs.existsSync(cacheFolder)) {
      fs.mkdirSync(cacheFolder);
    }

    if (!fs.existsSync(destinationFolder)) {
      fs.mkdirSync(destinationFolder);
    }

    const latest = await (await RemoteClientSystem.Run(`ls -t "${cacheFolder}" | grep .zip$ | head -1`)).replace(
      `\n`,
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
      CloudRunnerLogger.logCli(`Library cache exists`);
      await RemoteClientSystem.Run(`unzip "${cacheSelection}" -d "${destinationFolder}"`);
      assert(fs.existsSync(destinationFolder));
      await RemoteClientSystem.Run(`tree ${destinationFolder}`);
    } else {
      CloudRunnerLogger.logCli(`Library cache doesn't exist`);
      if (cacheSelection !== ``) {
        throw new Error(`Failed to get library cache, but cache hit was found: ${cacheSelection}`);
      }
    }
  }
}
