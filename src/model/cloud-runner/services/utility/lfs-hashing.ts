import path from 'node:path';
import { CloudRunnerFolders } from '../../options/cloud-runner-folders';
import { CloudRunnerSystem } from '../core/cloud-runner-system';
import fs from 'node:fs';
import { Cli } from '../../../cli/cli';
import { CliFunction } from '../../../cli/cli-functions-repository';

export class LfsHashing {
  public static async createLFSHashFiles() {
    await CloudRunnerSystem.Run(`git lfs ls-files -l | cut -d ' ' -f1 | sort > .lfs-assets-guid`);
    await CloudRunnerSystem.Run(`md5sum .lfs-assets-guid > .lfs-assets-guid-sum`);
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
    if (!Cli.options) {
      return;
    }
    const folder = Cli.options['cachePushFrom'];
    LfsHashing.hashAllFiles(folder);
  }
}
