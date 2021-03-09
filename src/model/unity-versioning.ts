import * as core from '@actions/core';
import * as fs from 'fs';
import path from 'path';

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
      core.warning(`Could not find "${filePath}", keeping unityVersion as "auto"`);
      return 'auto';
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
