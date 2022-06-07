import { assert } from '../../../node_modules/console';
import fs from '../../../node_modules/fs';
import * as path from 'https://deno.land/std@0.141.0/path/mod.ts';
import CloudRunner from '../cloud-runner.ts';
import CloudRunnerLogger from '../services/cloud-runner-logger.ts';
import { CloudRunnerFolders } from '../services/cloud-runner-folders.ts';
import { CloudRunnerSystem } from '../services/cloud-runner-system.ts';
import { LfsHashing } from '../services/lfs-hashing.ts';
import { RemoteClientLogger } from './remote-client-logger.ts';
import { Cli } from '../../cli/cli.ts';
import { CliFunction } from '../../cli/cli-functions-repository.ts';
// eslint-disable-next-line github/no-then
const fileExists = async (fpath) => !!(await fs.promises.stat(fpath).catch(() => false));

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
      if (!(await fileExists(cacheFolder))) {
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
      await CloudRunnerSystem.Run(`tar -cf ${cacheArtifactName}.tar ${path.basename(sourceFolder)}`);
      assert(await fileExists(`${cacheArtifactName}.tar`), 'cache archive exists');
      assert(await fileExists(path.basename(sourceFolder)), 'source folder exists');
      if (CloudRunner.buildParameters.cachePushOverrideCommand) {
        await CloudRunnerSystem.Run(formatFunction(CloudRunner.buildParameters.cachePushOverrideCommand));
      }
      await CloudRunnerSystem.Run(`mv ${cacheArtifactName}.tar ${cacheFolder}`);
      RemoteClientLogger.log(`moved cache entry ${cacheArtifactName} to ${cacheFolder}`);
      assert(
        await fileExists(`${path.join(cacheFolder, cacheArtifactName)}.tar`),
        'cache archive exists inside cache folder',
      );
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
      if (!(await fileExists(cacheFolder))) {
        await fs.promises.mkdir(cacheFolder);
      }

      if (!(await fileExists(destinationFolder))) {
        await fs.promises.mkdir(destinationFolder);
      }

      const latestInBranch = await (await CloudRunnerSystem.Run(`ls -t "${cacheFolder}" | grep .tar$ | head -1`))
        .replace(/\n/g, ``)
        .replace('.tar', '');

      process.chdir(cacheFolder);

      const cacheSelection =
        cacheArtifactName !== `` && (await fileExists(`${cacheArtifactName}.tar`)) ? cacheArtifactName : latestInBranch;
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

      if (await fileExists(`${cacheSelection}.tar`)) {
        const resultsFolder = `results${CloudRunner.buildParameters.buildGuid}`;
        await CloudRunnerSystem.Run(`mkdir -p ${resultsFolder}`);
        RemoteClientLogger.log(`cache item exists ${cacheFolder}/${cacheSelection}.tar`);
        const fullResultsFolder = path.join(cacheFolder, resultsFolder);
        await CloudRunnerSystem.Run(`tar -xf ${cacheSelection}.tar -C ${fullResultsFolder}`);
        RemoteClientLogger.log(`cache item extracted to ${fullResultsFolder}`);
        assert(await fileExists(fullResultsFolder), `cache extraction results folder exists`);
        const destinationParentFolder = path.resolve(destinationFolder, '..');

        if (await fileExists(destinationFolder)) {
          await fs.promises.rmdir(destinationFolder, { recursive: true });
        }
        await CloudRunnerSystem.Run(
          `mv "${path.join(fullResultsFolder, path.basename(destinationFolder))}" "${destinationParentFolder}"`,
        );
        const contents = await fs.promises.readdir(
          path.join(destinationParentFolder, path.basename(destinationFolder)),
        );
        CloudRunnerLogger.log(
          `There is ${contents.length} files/dir in the cache pulled contents for ${path.basename(destinationFolder)}`,
        );
      } else {
        RemoteClientLogger.logWarning(`cache item ${cacheArtifactName} doesn't exist ${destinationFolder}`);
        if (cacheSelection !== ``) {
          RemoteClientLogger.logWarning(`cache item ${cacheArtifactName}.tar doesn't exist ${destinationFolder}`);
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
