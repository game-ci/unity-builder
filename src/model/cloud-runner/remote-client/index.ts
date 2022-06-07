import fs from '../../../node_modules/fs';
import CloudRunner from '../cloud-runner.ts';
import { CloudRunnerFolders } from '../services/cloud-runner-folders.ts';
import { Caching } from './caching.ts';
import { LfsHashing } from '../services/lfs-hashing.ts';
import { RemoteClientLogger } from './remote-client-logger.ts';
import * as path from 'https://deno.land/std@0.141.0/path/mod.ts';
import { assert } from '../../../node_modules/console';
import CloudRunnerLogger from '../services/cloud-runner-logger.ts';
import { CliFunction } from '../../cli/cli-functions-repository.ts';
import { CloudRunnerSystem } from '../services/cloud-runner-system.ts';

export class RemoteClient {
  public static async bootstrapRepository() {
    try {
      await CloudRunnerSystem.Run(`mkdir -p ${CloudRunnerFolders.uniqueCloudRunnerJobFolderAbsolute}`);
      await CloudRunnerSystem.Run(`mkdir -p ${CloudRunnerFolders.repoPathAbsolute}`);
      await CloudRunnerSystem.Run(`mkdir -p ${CloudRunnerFolders.cacheFolderFull}`);
      process.chdir(CloudRunnerFolders.repoPathAbsolute);
      await RemoteClient.cloneRepoWithoutLFSFiles();
      await RemoteClient.sizeOfFolder('repo before lfs cache pull', CloudRunnerFolders.repoPathAbsolute);
      const lfsHashes = await LfsHashing.createLFSHashFiles();
      if (fs.existsSync(CloudRunnerFolders.libraryFolderAbsolute)) {
        RemoteClientLogger.logWarning(`!Warning!: The Unity library was included in the git repository`);
      }
      await Caching.PullFromCache(
        CloudRunnerFolders.lfsCacheFolderFull,
        CloudRunnerFolders.lfsFolderAbsolute,
        `${lfsHashes.lfsGuidSum}`,
      );
      await RemoteClient.sizeOfFolder('repo after lfs cache pull', CloudRunnerFolders.repoPathAbsolute);
      await RemoteClient.pullLatestLFS();
      await RemoteClient.sizeOfFolder('repo before lfs git pull', CloudRunnerFolders.repoPathAbsolute);
      await Caching.PushToCache(
        CloudRunnerFolders.lfsCacheFolderFull,
        CloudRunnerFolders.lfsFolderAbsolute,
        `${lfsHashes.lfsGuidSum}`,
      );
      await Caching.PullFromCache(CloudRunnerFolders.libraryCacheFolderFull, CloudRunnerFolders.libraryFolderAbsolute);
      await RemoteClient.sizeOfFolder('repo after library cache pull', CloudRunnerFolders.repoPathAbsolute);
      await Caching.handleCachePurging();
    } catch (error) {
      throw error;
    }
  }

  private static async sizeOfFolder(message: string, folder: string) {
    if (CloudRunner.buildParameters.cloudRunnerIntegrationTests) {
      CloudRunnerLogger.log(`Size of ${message}`);
      await CloudRunnerSystem.Run(`du -sh ${folder}`);
    }
  }

  private static async cloneRepoWithoutLFSFiles() {
    try {
      process.chdir(`${CloudRunnerFolders.repoPathAbsolute}`);
      RemoteClientLogger.log(`Initializing source repository for cloning with caching of LFS files`);
      await CloudRunnerSystem.Run(`git config --global advice.detachedHead false`);
      RemoteClientLogger.log(`Cloning the repository being built:`);
      await CloudRunnerSystem.Run(`git config --global filter.lfs.smudge "git-lfs smudge --skip -- %f"`);
      await CloudRunnerSystem.Run(`git config --global filter.lfs.process "git-lfs filter-process --skip"`);
      await CloudRunnerSystem.Run(
        `git clone -q ${CloudRunnerFolders.targetBuildRepoUrl} ${path.resolve(
          `..`,
          path.basename(CloudRunnerFolders.repoPathAbsolute),
        )}`,
      );
      await CloudRunnerSystem.Run(`git lfs install`);
      assert(fs.existsSync(`.git`), 'git folder exists');
      RemoteClientLogger.log(`${CloudRunner.buildParameters.branch}`);
      await CloudRunnerSystem.Run(`git checkout ${CloudRunner.buildParameters.branch}`);
      assert(fs.existsSync(path.join(`.git`, `lfs`)), 'LFS folder should not exist before caching');
      RemoteClientLogger.log(`Checked out ${process.env.GITHUB_SHA}`);
    } catch (error) {
      throw error;
    }
  }

  private static async pullLatestLFS() {
    process.chdir(CloudRunnerFolders.repoPathAbsolute);
    await CloudRunnerSystem.Run(`git config --global filter.lfs.smudge "git-lfs smudge -- %f"`);
    await CloudRunnerSystem.Run(`git config --global filter.lfs.process "git-lfs filter-process"`);
    await CloudRunnerSystem.Run(`git lfs pull`);
    RemoteClientLogger.log(`pulled latest LFS files`);
    assert(fs.existsSync(CloudRunnerFolders.lfsFolderAbsolute));
  }

  @CliFunction(`remote-cli`, `sets up a repository, usually before a game-ci build`)
  static async runRemoteClientJob() {
    const buildParameter = JSON.parse(process.env.BUILD_PARAMETERS || '{}');
    RemoteClientLogger.log(`Build Params:
      ${JSON.stringify(buildParameter, undefined, 4)}
    `);
    CloudRunner.buildParameters = buildParameter;
    await RemoteClient.bootstrapRepository();
  }
}
