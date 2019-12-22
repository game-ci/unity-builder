const core = require('@actions/core');

export default class Input {
  static getFromUser() {
    // Input variables specified in workflows using "with" prop.
    const unityVersion = core.getInput('unityVersion');
    const targetPlatform = core.getInput('targetPlatform');
    const projectPath = core.getInput('projectPath');
    const buildName = core.getInput('buildName');
    const buildsPath = core.getInput('buildsPath');
    const buildMethod = core.getInput('buildMethod');

    return {
      unityVersion,
      targetPlatform,
      projectPath,
      buildName,
      buildsPath,
      buildMethod,
    };
  }
}
