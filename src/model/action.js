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

  static get name() {
    return 'unity-builder';
  }

  static get rootFolder() {
    if (Action.isRunningFromSource) {
      return path.dirname(path.dirname(path.dirname(__filename)));
    }

    return path.dirname(path.dirname(__filename));
  }

  static get actionFolder() {
    return `${Action.rootFolder}/action`;
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
      throw new Error(
        `Selected target build platform: {platform} is incorrect/not supported. Please refer to Unity BuildTarget for a list of available platforms`,
      );
    }
  }
}

export default Action;
