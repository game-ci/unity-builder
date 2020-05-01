import * as core from '@actions/core';
import Unity from './unity';
import Action from './action';

class Project {
  static get relativePath() {
    // Todo - properly use Input for this.
    const projectPath = core.getInput('projectPath') || '.';

    return `${projectPath}`;
  }

  static get absolutePath() {
    const { workspace } = Action;

    return `${workspace}/${this.relativePath}`;
  }

  static get libraryFolder() {
    return `${this.relativePath}/${Unity.libraryFolder}`;
  }
}

export default Project;
