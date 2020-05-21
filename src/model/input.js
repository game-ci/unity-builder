import Platform from './platform';
import Versioning from './versioning';

const core = require('@actions/core');

class Input {
  static async getFromUser() {
    // Input variables specified in workflows using "with" prop.
    const version = core.getInput('unityVersion');
    const targetPlatform = core.getInput('targetPlatform') || Platform.default;
    const rawProjectPath = core.getInput('projectPath') || '.';
    const buildName = core.getInput('buildName') || targetPlatform;
    const buildsPath = core.getInput('buildsPath') || 'build';
    const buildMethod = core.getInput('buildMethod'); // processed in docker file
    const versioningStrategy = core.getInput('versioning') || 'Semantic';
    const specifiedVersion = core.getInput('version') || '';
    const rawAllowDirtyBuild = core.getInput('allowDirtyBuild') || 'false';
    const customParameters = core.getInput('customParameters') || '';

    // Sanitise input
    const projectPath = rawProjectPath.replace(/\/$/, '');
    const allowDirtyBuild = rawAllowDirtyBuild === 'true' ? 'true' : 'false';

    // Parse input
    const buildVersion = await Versioning.determineVersion(versioningStrategy, specifiedVersion);

    // Return validated input
    return {
      version,
      targetPlatform,
      projectPath,
      buildName,
      buildsPath,
      buildMethod,
      buildVersion,
      allowDirtyBuild,
      customParameters,
    };
  }
}

export default Input;
