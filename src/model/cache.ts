import * as core from '@actions/core';
import fs from 'node:fs';
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

    core.warning(`
      Library folder does not exist.
      Consider setting up caching to speed up your workflow,
      if this is not your first build.
    `);
  }
}

export default Cache;
