import Input from './input';

class Unity {
  static get libraryFolder() {
    const { projectPath } = Input.getFromUser();
    return `${projectPath.replace(/\/$/, '')}/Library`;
  }
}

export default Unity;
