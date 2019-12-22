import path from 'path';

export default class Action {
  static get supportedPlatforms() {
    return ['linux'];
  }

  static get name() {
    return 'unity-builder';
  }

  static get rootFolder() {
    return path.dirname(path.dirname(__dirname));
  }

  static get dockerfile() {
    return `${Action.rootFolder}/Dockerfile`;
  }

  static get workspace() {
    return process.env.GITHUB_WORKSPACE;
  }

  static checkCompatibility() {
    const currentPlatform = process.platform;
    if (!Action.supportedPlatforms.includes(currentPlatform)) {
      throw new Error(`Currently ${currentPlatform}-platform is not supported`);
    }
  }
}
