const core = require('@actions/core');

export default class Input {
  static getFromUser() {
    // Input variables specified in workflows using "with" prop.
    const version = core.getInput('unityVersion');
    const platform = core.getInput('targetPlatform');
    const projectPath = core.getInput('projectPath');
    const buildName = core.getInput('buildName');
    const buildsPath = core.getInput('buildsPath');
    const buildMethod = core.getInput('buildMethod');

    return {
      version,
      platform,
      projectPath,
      buildName,
      buildsPath,
      method: buildMethod,
    };
  }
}
