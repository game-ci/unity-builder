import { fs, path } from '../dependencies.ts';

export default class UnityVersioning {
  static get versionPattern() {
    return /20\d{2}\.\d\.\w{3,4}|3/;
  }

  static determineUnityVersion(projectPath, unityVersion) {
    if (unityVersion === 'auto') {
      return UnityVersioning.read(projectPath);
    }

    return unityVersion;
  }

  static read(projectPath) {
    const filePath = path.join(projectPath, 'ProjectSettings', 'ProjectVersion.txt');
    if (!fs.existsSync(filePath)) {
      throw new Error(`Project settings file not found at "${filePath}". Have you correctly set the projectPath?`);
    }

    return UnityVersioning.parse(fs.readFileSync(filePath, 'utf8'));
  }

  static parse(projectVersionTxt) {
    const matches = projectVersionTxt.match(UnityVersioning.versionPattern);
    if (!matches || matches.length === 0) {
      throw new Error(`Failed to parse version from "${projectVersionTxt}".`);
    }

    return matches[0];
  }
}
