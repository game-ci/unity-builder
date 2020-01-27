import fs from 'fs';
import Action from './action';
import Project from './project';

class Cache {
  static verify() {
    if (!fs.existsSync(Project.libraryFolder)) {
      this.notifyAboutCachingPossibility();
    }
  }

  static notifyAboutCachingPossibility() {
    if (Action.isRunningLocally) {
      return;
    }

    // eslint-disable-next-line no-console
    console.log(`
      Library folder does not exist.
      Consider setting up caching to speed up your workflow
      If this is not your first build.`);
  }
}

export default Cache;
