import { assert } from 'console';
import fs from 'fs';
import path from 'path';
import CloudRunner from '../cloud-runner';
import CloudRunnerLogger from '../services/cloud-runner-logger';
import { CloudRunnerFolders } from '../services/cloud-runner-folders';
import { CloudRunnerSystem } from '../services/cloud-runner-system';
import { LFSHashing } from '../services/lfs-hashing';
import { RemoteClientLogger } from './remote-client-logger';
import { CLI } from '../../cli/cli';
import { CliFunction } from '../../cli/cli-functions-repository';

export class Caching {
  @CliFunction(`cache-push`, `push to cache`)
  static async cachePush() {
    try {
      const buildParameter = JSON.parse(process.env.BUILD_PARAMETERS || '{}');
      CloudRunner.buildParameters = buildParameter;
      await Caching.PushToCache(
        CLI.options['cachePushTo'],
        CLI.options['cachePushFrom'],
        CLI.options['artifactName'] || '',
      );
    } catch (error: any) {
      CloudRunnerLogger.log(`${error}`);
    }
  }

  @CliFunction(`cache-pull`, `pull from cache`)
  static async cachePull() {
    try {
      const buildParameter = JSON.parse(process.env.BUILD_PARAMETERS || '{}');
      CloudRunner.buildParameters = buildParameter;
      await Caching.PullFromCache(
        CLI.options['cachePushFrom'],
        CLI.options['cachePushTo'],
        CLI.options['artifactName'] || '',
      );
    } catch (error: any) {
      CloudRunnerLogger.log(`${error}`);
    }
  }
  public static async PushToCache(cacheFolder: string, sourceFolder: string, cacheArtifactName: string) {
    cacheArtifactName = cacheArtifactName.replace(' ', '');
    const startPath = process.cwd();
    try {
      if (!fs.existsSync(cacheFolder)) {
        await CloudRunnerSystem.Run(`mkdir -p ${cacheFolder}`);
      }
      CloudRunnerSystem.Run(`ls ${cacheFolder}`);
      CloudRunnerSystem.Run(`ls ${sourceFolder}`);
      process.chdir(path.resolve(sourceFolder, '..'));

      if (CloudRunner.buildParameters.cloudRunnerIntegrationTests) {
        CloudRunnerLogger.log(
          `Hashed cache folder ${await LFSHashing.hashAllFiles(sourceFolder)} ${sourceFolder} ${path.basename(
            sourceFolder,
          )}`,
        );
      }
      // eslint-disable-next-line func-style
      const formatFunction = function (format: string) {
        const arguments_ = Array.prototype.slice.call(
          [path.resolve(sourceFolder, '..'), cacheFolder, cacheArtifactName],
          1,
        );
        return format.replace(/{(\d+)}/g, function (match, number) {
          return typeof arguments_[number] != 'undefined' ? arguments_[number] : match;
        });
      };
      await CloudRunnerSystem.Run(`zip -q ${cacheArtifactName}.zip ${path.basename(sourceFolder)}`);
      assert(fs.existsSync(`${cacheArtifactName}.zip`), 'cache zip exists');
      assert(fs.existsSync(path.basename(sourceFolder)), 'source folder exists');
      if (CloudRunner.buildParameters.cachePushOverrideCommand) {
        CloudRunnerSystem.Run(formatFunction(CloudRunner.buildParameters.cachePushOverrideCommand));
      }
      CloudRunnerSystem.Run(`mv ${cacheArtifactName}.zip ${cacheFolder}`);
      RemoteClientLogger.log(`moved ${cacheArtifactName}.zip to ${cacheFolder}`);
      assert(fs.existsSync(`${path.join(cacheFolder, cacheArtifactName)}.zip`), 'cache zip exists inside cache folder');
    } catch (error) {
      process.chdir(`${startPath}`);
      throw error;
    }
    process.chdir(`${startPath}`);
  }
  public static async PullFromCache(cacheFolder: string, destinationFolder: string, cacheArtifactName: string = ``) {
    cacheArtifactName = cacheArtifactName.replace(' ', '');
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
      CloudRunnerSystem.Run(`ls ${cacheFolder}`);
      CloudRunnerSystem.Run(`ls ${destinationFolder}`);

      const cacheSelection =
        cacheArtifactName !== `` && fs.existsSync(`${cacheArtifactName}.zip`) ? cacheArtifactName : latestInBranch;
      await CloudRunnerLogger.log(`cache key ${cacheArtifactName} selection ${cacheSelection}`);

      // eslint-disable-next-line func-style
      const formatFunction = function (format: string) {
        const arguments_ = Array.prototype.slice.call(
          [path.resolve(destinationFolder, '..'), cacheFolder, cacheArtifactName],
          1,
        );
        return format.replace(/{(\d+)}/g, function (match, number) {
          return typeof arguments_[number] != 'undefined' ? arguments_[number] : match;
        });
      };

      if (CloudRunner.buildParameters.cachePullOverrideCommand) {
        CloudRunnerSystem.Run(formatFunction(CloudRunner.buildParameters.cachePullOverrideCommand));
      }

      if (fs.existsSync(`${cacheSelection}.zip`)) {
        const resultsFolder = `results${CloudRunner.buildParameters.buildGuid}`;
        await CloudRunnerSystem.Run(`mkdir -p ${resultsFolder}`);
        RemoteClientLogger.log(`cache item exists ${cacheFolder}/${cacheSelection}.zip`);
        assert(`${fs.existsSync(destinationFolder)}`, `destination folder to pull into exists`);
        const fullResultsFolder = path.join(cacheFolder, resultsFolder);
        await CloudRunnerSystem.Run(`unzip -q ${cacheSelection}.zip -d ${path.basename(resultsFolder)}`);
        RemoteClientLogger.log(`cache item extracted to ${fullResultsFolder}`);
        assert(`${fs.existsSync(fullResultsFolder)}`, `cache extraction results folder exists`);
        const destinationParentFolder = path.resolve(destinationFolder, '..');
        if (fs.existsSync(destinationFolder)) {
          fs.rmSync(destinationFolder, { recursive: true, force: true });
        }
        await CloudRunnerSystem.Run(
          `mv "${fullResultsFolder}/${path.basename(destinationFolder)}" "${destinationParentFolder}"`,
        );
      } else {
        RemoteClientLogger.logWarning(`cache item ${cacheArtifactName} doesn't exist ${destinationFolder}`);
        if (cacheSelection !== ``) {
          RemoteClientLogger.logWarning(`cache item ${cacheArtifactName}.zip doesn't exist ${destinationFolder}`);
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
      RemoteClientLogger.log(`purging ${CloudRunnerFolders.purgeRemoteCaching}`);
      fs.rmdirSync(CloudRunnerFolders.cacheFolder, { recursive: true });
    }
  }
}
