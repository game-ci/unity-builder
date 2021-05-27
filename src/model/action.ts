import path from 'path';

class Action {
  static get supportedPlatforms() {
    return ['linux'];
  }

  static get isRunningLocally() {
    return process.env.RUNNER_WORKSPACE === undefined;
  }

  static get isRunningFromSource() {
    return path.basename(__dirname) === 'model';
  }

  static get canonicalName() {
    return 'unity-builder';
  }

  static get rootFolder() {
    if (Action.isRunningFromSource) {
      return path.dirname(path.dirname(path.dirname(__filename)));
    }

    return path.dirname(path.dirname(__filename));
  }

  static get actionFolder() {
    return `${Action.rootFolder}/dist`;
  }

  static get dockerfile() {
    return `${Action.actionFolder}/Dockerfile`;
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

export default Action;
