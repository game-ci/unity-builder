import * as core from '../../../node_modules/@actions/core';
import fs from '../../../node_modules/fs';
import Action from './action.ts';
import Project from './project.ts';

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

    core.warning(`
      Library folder does not exist.
      Consider setting up caching to speed up your workflow,
      if this is not your first build.
    `);
  }
}

export default Cache;
