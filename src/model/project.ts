import Input from './input.ts';
import Unity from './unity.ts';
import Action from './action.ts';

class Project {
  static get relativePath() {
    const { projectPath } = Input;

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
