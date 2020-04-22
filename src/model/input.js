import Platform from './platform';
import ValidationError from './error/validation-error';

const core = require('@actions/core');

const versioningStrategies = ['None', 'Semantic', 'Tag', 'Custom'];

class Input {
  static getFromUser() {
    // Input variables specified in workflows using "with" prop.
    const unityVersion = core.getInput('unityVersion');
    const targetPlatform = core.getInput('targetPlatform') || Platform.default;
    const rawProjectPath = core.getInput('projectPath') || '.';
    const buildName = core.getInput('buildName') || targetPlatform;
    const buildsPath = core.getInput('buildsPath') || 'build';
    const buildMethod = core.getInput('buildMethod'); // processed in docker file
    const versioning = core.getInput('versioning') || 'Semantic';
    const version = core.getInput('version') || '';
    const customParameters = core.getInput('customParameters') || '';

    // Sanitise input
    const projectPath = rawProjectPath.replace(/\/$/, '');

    // Validate input
    if (!versioningStrategies.includes(versioning)) {
      throw new ValidationError(
        `Versioning strategy should be one of ${versioningStrategies.join(', ')}.`,
      );
    }

    // Return sanitised input
    return {
      unityVersion,
      targetPlatform,
      projectPath,
      buildName,
      buildsPath,
      buildMethod,
      versioning,
      version,
      customParameters,
    };
  }
}

export default Input;
