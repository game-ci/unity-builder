import Input from './input';
import Unity from './unity';

const tc = require('@actions/tool-cache');
const exec = require('@actions/exec');
const core = require('@actions/core');

class Cache {
  static get libraryKey() {
    const { projectPath, targetPlatform } = Input.getFromUser();

    return `${projectPath}-${targetPlatform}`;
  }

  static async load() {
    // Look for cache
    const libraryFolder = await tc.find('library', this.libraryKey);

    // Cache miss
    if (!libraryFolder) {
      console.log(`Cache was not available for "${this.libraryKey}"`);
      return;
    }

    // Restore
    console.log(`Restoring cache "${libraryFolder}"`);
    await core.addPath(libraryFolder);
    console.log(`contents of ${libraryFolder}`);
    await exec.exec(`ls -alh ${libraryFolder}`);
  }

  static async save() {
    const cachedPath = await tc.cacheDir(Unity.libraryFolder, 'library', this.libraryKey);

    console.log(`cached ${cachedPath}`);

    console.log(`Contents of ${Unity.libraryFolder}:`);
    await exec.exec(`ls -alh ${Unity.libraryFolder}`);

    console.log(`contents of ${cachedPath}`);
    await exec.exec(`ls -alh ${cachedPath}`);
  }
}

export default Cache;
