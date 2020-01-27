import Unity from './unity';
import Input from './input';
import Action from './action';

class Project {
  static get relativePath() {
    const { projectPath } = Input.getFromUser();

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
