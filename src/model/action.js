import path from 'path';

export default class Action {
  static get supportedPlatforms() {
    return ['linux'];
  }

  static get isRunningLocally() {
    return process.env.RUNNER_WORKSPACE === undefined;
  }

  static get isRunningFromSource() {
    return __dirname !== 'dist';
  }

  static get name() {
    return 'unity-builder';
  }

  static get rootFolder() {
    if (!Action.isRunningLocally) {
      const workspace = process.env.RUNNER_WORKSPACE;
      return `${workspace}/${path.basename(workspace)}`;
    }

    if (Action.isRunningFromSource) {
      return path.dirname(path.dirname(path.dirname(__filename)));
    }

    return path.dirname(path.dirname(__filename));
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
