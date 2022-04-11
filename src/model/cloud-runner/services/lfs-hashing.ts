import path from 'path';
import { CloudRunnerFolders } from './cloud-runner-folders';
import { CloudRunnerSystem } from './cloud-runner-system';
import fs from 'fs';
import { assert } from 'console';
import { Cli } from '../../cli/cli';
import { CliFunction } from '../../cli/cli-functions-repository';

export class LfsHashing {
  public static async createLFSHashFiles() {
    try {
      await CloudRunnerSystem.Run(`git lfs ls-files -l | cut -d ' ' -f1 | sort > .lfs-assets-guid`);
      await CloudRunnerSystem.Run(`md5sum .lfs-assets-guid > .lfs-assets-guid-sum`);
      assert(fs.existsSync(`.lfs-assets-guid-sum`));
      assert(fs.existsSync(`.lfs-assets-guid`));
      const lfsHashes = {
        lfsGuid: fs
          .readFileSync(`${path.join(CloudRunnerFolders.repoPathAbsolute, `.lfs-assets-guid`)}`, 'utf8')
          .replace(/\n/g, ``),
        lfsGuidSum: fs
          .readFileSync(`${path.join(CloudRunnerFolders.repoPathAbsolute, `.lfs-assets-guid-sum`)}`, 'utf8')
          .replace('  .lfs-assets-guid', '')
          .replace(/\n/g, ``),
      };

      return lfsHashes;
    } catch (error) {
      throw error;
    }
  }
  public static async hashAllFiles(folder: string) {
    const startPath = process.cwd();
    process.chdir(folder);
    const result = await (await CloudRunnerSystem.Run(`find -type f -exec md5sum "{}" + | sort | md5sum`))
      .replace(/\n/g, '')
      .split(` `)[0];
    process.chdir(startPath);

    return result;
  }

  @CliFunction(`hash`, `hash all folder contents`)
  static async hash() {
    const folder = Cli.options['cachePushFrom'];
    LfsHashing.hashAllFiles(folder);
  }
}
