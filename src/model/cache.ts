import { fsSync, core } from '../dependencies.ts';
import Action from './action.ts';
import Project from './project.ts';

class Cache {
  static verify() {
    if (!fsSync.existsSync(Project.libraryFolder)) {
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
