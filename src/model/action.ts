import { path, __dirname } from '../dependencies.ts';

class Action {
  static get supportedPlatforms() {
    return ['linux', 'win32', 'darwin'];
  }

  static get isRunningLocally() {
    return Deno.env.get('RUNNER_WORKSPACE') === undefined;
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

  static get workspace() {
    return Deno.env.get('GITHUB_WORKSPACE');
  }

  static checkCompatibility() {
    const currentPlatform = process.platform;
    if (!Action.supportedPlatforms.includes(currentPlatform)) {
      throw new Error(`Currently ${currentPlatform}-platform is not supported`);
    }
  }
}

export default Action;
