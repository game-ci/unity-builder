import Platform from './platform';

const core = require('@actions/core');

class Input {
  static getFromUser() {
    // Input variables specified in workflows using "with" prop.
    const unityVersion = core.getInput('unityVersion');
    const targetPlatform = core.getInput('targetPlatform') || Platform.default;
    const rawProjectPath = core.getInput('projectPath') || '.';
    const buildName = core.getInput('buildName') || targetPlatform;
    const buildsPath = core.getInput('buildsPath') || 'build';
    const buildMethod = core.getInput('buildMethod'); // processed in docker file
    const customParameters = core.getInput('customParameters') || '';

    // Sanitise input
    const projectPath = rawProjectPath.replace(/\/$/, '');

    // Return sanitised input
    return {
      unityVersion,
      targetPlatform,
      projectPath,
      buildName,
      buildsPath,
      buildMethod,
      customParameters,
    };
  }
}

export default Input;
