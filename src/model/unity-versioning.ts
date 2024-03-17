import fs from 'node:fs';
import path from 'node:path';

export default class UnityVersioning {
  static determineUnityVersion(projectPath: string, unityVersion: string) {
    if (unityVersion === 'auto') {
      return UnityVersioning.read(projectPath);
    }

    return unityVersion;
  }

  static read(projectPath: string) {
    const filePath = path.join(projectPath, 'ProjectSettings', 'ProjectVersion.txt');
    if (!fs.existsSync(filePath)) {
      throw new Error(`Project settings file not found at "${filePath}". Have you correctly set the projectPath?`);
    }

    return UnityVersioning.parse(fs.readFileSync(filePath, 'utf8'));
  }

  static parse(projectVersionTxt: string) {
    const versionRegex = /m_EditorVersion: (\d+\.\d+\.\d+[A-Za-z]?\d+)/;
    const matches = projectVersionTxt.match(versionRegex);

    if (!matches || matches.length < 2) {
      throw new Error(`Failed to extract version from "${projectVersionTxt}".`);
    }

    return matches[1];
  }
}
