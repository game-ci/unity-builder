import fs from 'fs';
import path from 'path';
import { Cli } from './cli/cli';
import CloudRunnerQueryOverride from './cloud-runner/services/cloud-runner-query-override';
import Platform from './platform';
import GitHub from './github';

const core = require('@actions/core');

/**
 * Input variables specified in workflows using "with" prop.
 *
 * Note that input is always passed as a string, even booleans.
 *
 * Todo: rename to UserInput and remove anything that is not direct input from the user / ci workflow
 */
class Input {
  public static getInput(query) {
    if (GitHub.githubInputEnabled) {
      const coreInput = core.getInput(query);
      if (coreInput && coreInput !== '') {
        return coreInput;
      }
    }
    const alternativeQuery = Input.ToEnvVarFormat(query);

    // Query input sources
    if (Cli.query(query, alternativeQuery)) {
      return Cli.query(query, alternativeQuery);
    }

    if (CloudRunnerQueryOverride.query(query, alternativeQuery)) {
      return CloudRunnerQueryOverride.query(query, alternativeQuery);
    }

    if (process.env[query] !== undefined) {
      return process.env[query];
    }

    if (alternativeQuery !== query && process.env[alternativeQuery] !== undefined) {
      return process.env[alternativeQuery];
    }

    return;
  }

  static get region(): string {
    return Input.getInput('region') || 'eu-west-2';
  }

  static get githubRepo() {
    return Input.getInput('GITHUB_REPOSITORY') || Input.getInput('GITHUB_REPO') || undefined;
  }
  static get branch() {
    if (Input.getInput(`GITHUB_REF`)) {
      return Input.getInput(`GITHUB_REF`).replace('refs/', '').replace(`head/`, '').replace(`heads/`, '');
    } else if (Input.getInput('branch')) {
      return Input.getInput('branch');
    } else {
      return '';
    }
  }

  static get gitSha() {
    if (Input.getInput(`GITHUB_SHA`)) {
      return Input.getInput(`GITHUB_SHA`);
    } else if (Input.getInput(`GitSHA`)) {
      return Input.getInput(`GitSHA`);
    }
  }

  static get useIL2Cpp() {
    return Input.getInput(`useIL2Cpp`) || true;
  }

  static get runNumber() {
    return Input.getInput('GITHUB_RUN_NUMBER') || '0';
  }

  static get targetPlatform() {
    return Input.getInput('targetPlatform') || Platform.default;
  }

  static get unityVersion() {
    return Input.getInput('unityVersion') || 'auto';
  }

  static get customImage() {
    return Input.getInput('customImage') || '';
  }

  static get projectPath() {
    const input = Input.getInput('projectPath');
    const rawProjectPath = input
      ? input
      : fs.existsSync(path.join('test-project', 'ProjectSettings', 'ProjectVersion.txt')) &&
        !fs.existsSync(path.join('ProjectSettings', 'ProjectVersion.txt'))
      ? 'test-project'
      : '.';

    return rawProjectPath.replace(/\/$/, '');
  }

  static get buildName() {
    return Input.getInput('buildName') || this.targetPlatform;
  }

  static get buildsPath() {
    return Input.getInput('buildsPath') || 'build';
  }

  static get unityLicensingServer() {
    return Input.getInput('unityLicensingServer') || '';
  }

  static get buildMethod() {
    return Input.getInput('buildMethod') || ''; // Processed in docker file
  }

  static get customParameters() {
    return Input.getInput('customParameters') || '';
  }

  static get versioningStrategy() {
    return Input.getInput('versioning') || 'Semantic';
  }

  static get specifiedVersion() {
    return Input.getInput('version') || '';
  }

  static get androidVersionCode() {
    return Input.getInput('androidVersionCode');
  }

  static get androidAppBundle() {
    core.warning('androidAppBundle is deprecated, please use androidExportType instead');
    const input = Input.getInput('androidAppBundle') || false;

    return input === 'true';
  }

  static get androidExportType() {
    // TODO: remove this in V3
    const exportType = Input.getInput('androidExportType');

    if (exportType) {
      return exportType || 'androidPackage';
    }

    return Input.androidAppBundle ? 'androidAppBundle' : 'androidPackage';

    // End TODO

    // Use this in V3 when androidAppBundle is removed
    // return Input.getInput('androidExportType') || 'androidPackage';
  }

  static get androidKeystoreName() {
    return Input.getInput('androidKeystoreName') || '';
  }

  static get androidKeystoreBase64() {
    return Input.getInput('androidKeystoreBase64') || '';
  }

  static get androidKeystorePass() {
    return Input.getInput('androidKeystorePass') || '';
  }

  static get androidKeyaliasName() {
    return Input.getInput('androidKeyaliasName') || '';
  }

  static get androidKeyaliasPass() {
    return Input.getInput('androidKeyaliasPass') || '';
  }

  static get androidTargetSdkVersion() {
    return Input.getInput('androidTargetSdkVersion') || '';
  }

  static get androidSymbolType() {
    return Input.getInput('androidSymbolType') || 'none';
  }

  static get sshAgent() {
    return Input.getInput('sshAgent') || '';
  }

  static get gitPrivateToken() {
    return core.getInput('gitPrivateToken') || false;
  }

  static get chownFilesTo() {
    return Input.getInput('chownFilesTo') || '';
  }

  static get allowDirtyBuild() {
    const input = Input.getInput('allowDirtyBuild') || false;

    return input === 'true';
  }

  static get cacheUnityInstallationOnMac() {
    const input = Input.getInput('cacheUnityInstallationOnMac') || false;

    return input === 'true';
  }

  static get unityHubVersionOnMac() {
    const input = Input.getInput('unityHubVersionOnMac') || '';

    return input !== '' ? input : '';
  }

  public static ToEnvVarFormat(input: string) {
    if (input.toUpperCase() === input) {
      return input;
    }

    return input
      .replace(/([A-Z])/g, ' $1')
      .trim()
      .toUpperCase()
      .replace(/ /g, '_');
  }
}

export default Input;
