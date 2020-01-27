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

    console.log('Library folder does not exist.');
    console.log('Consider setting up caching to speed up your workflow.');
    console.log('If this is not your first build.');
  }
}

export default Cache;
