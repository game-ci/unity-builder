import { fsSync as fs, path } from '../../dependencies.ts';

export default class UnityVersionDetector {
  static get versionPattern() {
    return /20\d{2}\.\d\.\w{3,4}|3/;
  }

  public static isUnityProject(projectPath) {
    try {
      UnityVersionDetector.read(projectPath);

      return true;
    } catch {
      return false;
    }
  }

  static getUnityVersion(projectPath) {
    return UnityVersionDetector.read(projectPath);
  }

  static read(projectPath) {
    const filePath = path.join(projectPath, 'ProjectSettings', 'ProjectVersion.txt');
    if (!fs.existsSync(filePath)) {
      throw new Error(`Project settings file not found at "${filePath}". Have you correctly set the projectPath?`);
    }

    return UnityVersionDetector.parse(Deno.readTextFileSync(filePath, 'utf8'));
  }

  static parse(projectVersionTxt) {
    const matches = projectVersionTxt.match(UnityVersionDetector.versionPattern);
    if (!matches || matches.length === 0) {
      throw new Error(`Failed to parse version from "${projectVersionTxt}".`);
    }

    return matches[0];
  }
}
