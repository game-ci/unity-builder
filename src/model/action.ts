import path from 'path';

class Action {
  static get supportedPlatforms() {
    return ['linux', 'win32', 'darwin'];
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
    const currentPlatform = process.platform;
    switch (currentPlatform) {
      case 'linux':
        return `${Action.actionFolder}/platforms/ubuntu/Dockerfile`;
      case 'win32':
        return `${Action.actionFolder}/platforms/windows/Dockerfile`;
      case 'darwin':
        return 'unused'; //Mac doesn't use a container
      default:
        throw new Error(`No Dockerfile for currently unsupported platform: ${currentPlatform}`);
    }
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
