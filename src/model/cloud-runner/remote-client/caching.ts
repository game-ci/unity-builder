import { assert } from 'console';
import fs from 'fs';
import path from 'path';
import CloudRunner from '../cloud-runner';
import CloudRunnerLogger from '../services/cloud-runner-logger';
import { CloudRunnerFolders } from '../services/cloud-runner-folders';
import { CloudRunnerSystem } from '../services/cloud-runner-system';
import { LfsHashing } from '../services/lfs-hashing';
import { RemoteClientLogger } from './remote-client-logger';
import { Cli } from '../../cli/cli';
import { CliFunction } from '../../cli/cli-functions-repository';

export class Caching {
  @CliFunction(`cache-push`, `push to cache`)
  static async cachePush() {
    try {
      const buildParameter = JSON.parse(process.env.BUILD_PARAMETERS || '{}');
      CloudRunner.buildParameters = buildParameter;
      await Caching.PushToCache(
        Cli.options['cachePushTo'],
        Cli.options['cachePushFrom'],
        Cli.options['artifactName'] || '',
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
        Cli.options['cachePushFrom'],
        Cli.options['cachePushTo'],
        Cli.options['artifactName'] || '',
      );
    } catch (error: any) {
      CloudRunnerLogger.log(`${error}`);
    }
  }

  public static async PushToCache(cacheFolder: string, sourceFolder: string, cacheArtifactName: string) {
    cacheArtifactName = cacheArtifactName.replace(' ', '');
    const startPath = process.cwd();
    try {
      const cacheFolderStat = await fs.promises.stat(cacheFolder);
      if (!cacheFolderStat.isDirectory()) {
        await CloudRunnerSystem.Run(`mkdir -p ${cacheFolder}`);
      }
      process.chdir(path.resolve(sourceFolder, '..'));

      if (CloudRunner.buildParameters.cloudRunnerIntegrationTests) {
        CloudRunnerLogger.log(
          `Hashed cache folder ${await LfsHashing.hashAllFiles(sourceFolder)} ${sourceFolder} ${path.basename(
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
      await CloudRunnerSystem.Run(`zip -q -r ${cacheArtifactName}.zip ${path.basename(sourceFolder)}`);
      const cacheArtifactStatPreMove = await fs.promises.stat(`${cacheArtifactName}.zip`);
      assert(cacheArtifactStatPreMove.isFile(), 'cache zip exists');
      const sourceFolderStat = await fs.promises.stat(path.basename(sourceFolder));
      assert(sourceFolderStat.isDirectory(), 'source folder exists');
      if (CloudRunner.buildParameters.cachePushOverrideCommand) {
        await CloudRunnerSystem.Run(formatFunction(CloudRunner.buildParameters.cachePushOverrideCommand));
      }
      await CloudRunnerSystem.Run(`mv ${cacheArtifactName}.zip ${cacheFolder}`);
      RemoteClientLogger.log(`moved ${cacheArtifactName}.zip to ${cacheFolder}`);
      const cacheArtifactStat = await fs.promises.stat(`${path.join(cacheFolder, cacheArtifactName)}.zip`);
      assert(cacheArtifactStat.isFile(), 'cache zip exists inside cache folder');
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
      const cacheFolderStat = await fs.promises.stat(cacheFolder);
      if (!cacheFolderStat.isDirectory()) {
        await fs.promises.mkdir(cacheFolder);
      }

      const destinationStat = await fs.promises.stat(destinationFolder);

      if (!destinationStat.isDirectory()) {
        await fs.promises.mkdir(destinationFolder);
      }

      const latestInBranch = await (await CloudRunnerSystem.Run(`ls -t "${cacheFolder}" | grep .zip$ | head -1`))
        .replace(/\n/g, ``)
        .replace('.zip', '');

      process.chdir(cacheFolder);
      const cacheArtifactStat = await fs.promises.stat(`${cacheArtifactName}.zip`);

      const cacheSelection =
        cacheArtifactName !== `` && cacheArtifactStat.isFile() ? cacheArtifactName : latestInBranch;
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
        await CloudRunnerSystem.Run(formatFunction(CloudRunner.buildParameters.cachePullOverrideCommand));
      }

      const cacheSelectionExistsStat = await fs.promises.stat(`${cacheSelection}.zip`);
      if (cacheSelectionExistsStat.isFile()) {
        const resultsFolder = `results${CloudRunner.buildParameters.buildGuid}`;
        await CloudRunnerSystem.Run(`mkdir -p ${resultsFolder}`);
        RemoteClientLogger.log(`cache item exists ${cacheFolder}/${cacheSelection}.zip`);
        const fullResultsFolder = path.join(cacheFolder, resultsFolder);
        await CloudRunnerSystem.Run(`unzip -q ${cacheSelection}.zip -d ${path.basename(resultsFolder)}`);
        RemoteClientLogger.log(`cache item extracted to ${fullResultsFolder}`);
        const fullResultsFolderStat = await fs.promises.stat(fullResultsFolder);
        assert(fullResultsFolderStat.isDirectory(), `cache extraction results folder exists`);
        const destinationParentFolder = path.resolve(destinationFolder, '..');

        const destinationFolderStat = await fs.promises.stat(destinationFolder);
        if (destinationFolderStat.isDirectory()) {
          await fs.promises.rmdir(destinationFolder, { recursive: true });
        }
        await CloudRunnerSystem.Run(
          `mv "${path.join(fullResultsFolder, path.basename(destinationFolder))}" "${destinationParentFolder}"`,
        );
        await CloudRunnerSystem.Run(`du -sh ${path.join(destinationParentFolder, path.basename(destinationFolder))}`);
        const contents = await fs.promises.readdir(
          path.join(destinationParentFolder, path.basename(destinationFolder)),
        );
        CloudRunnerLogger.log(
          `There is ${contents.length} files/dir in the cache pulled contents for ${path.basename(destinationFolder)}`,
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

  public static async handleCachePurging() {
    if (process.env.PURGE_REMOTE_BUILDER_CACHE !== undefined) {
      RemoteClientLogger.log(`purging ${CloudRunnerFolders.purgeRemoteCaching}`);
      fs.promises.rmdir(CloudRunnerFolders.cacheFolder, { recursive: true });
    }
  }
}
