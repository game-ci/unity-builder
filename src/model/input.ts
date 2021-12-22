import Platform from './platform';

const core = require('@actions/core');

/**
 * Input variables specified in workflows using "with" prop.
 *
 * Note that input is always passed as a string, even booleans.
 */
class Input {
  public static githubEnabled = true;
  public static cliOptions;
  static get remoteBuilderIntegrationTests(): boolean {
    return Input.getInput(`remoteBuilderIntegrationTests`) || Input.getInput(`remoteBuilderTests`);
  }
  private static getInput(query) {
    return Input.githubEnabled
      ? core.getInput(query)
      : Input.cliOptions !== undefined && Input.cliOptions[query] !== undefined
      ? Input.cliOptions[query]
      : process.env[query] !== undefined
      ? process.env[query]
      : false;
  }
  static get region(): string {
    return Input.getInput('region') || 'eu-west-2';
  }
  static get githubRepo(): string {
    return Input.getInput('GITHUB_REPOSITORY') || 'game-ci/unity-builder';
  }
  static get branch() {
    if (Input.getInput(`REMOTE_BUILDER_CACHE`)) {
      return Input.getInput(`REMOTE_BUILDER_CACHE`);
    } else if (Input.getInput(`GITHUB_REF`)) {
      return Input.getInput(`GITHUB_REF`)
        .split('/')
        .filter((x) => {
          x = x[0].toUpperCase() + x.slice(1);
          return x;
        })
        .join('');
    } else if (Input.getInput('branch')) {
      return Input.getInput('branch');
    } else {
      return 'remote-builder/unified-providers';
    }
  }
  static get runNumber() {
    return Input.getInput('GITHUB_RUN_NUMBER') || '0';
  }

  static get unityVersion() {
    return Input.getInput('unityVersion') || 'auto';
  }

  static get customImage() {
    return Input.getInput('customImage');
  }

  static get targetPlatform() {
    return Input.getInput('targetPlatform') || Platform.default;
  }

  static get projectPath() {
    const rawProjectPath = Input.getInput('projectPath') || '.';
    return rawProjectPath.replace(/\/$/, '');
  }

  static get buildName() {
    return Input.getInput('buildName') || this.targetPlatform;
  }

  static get buildsPath() {
    return Input.getInput('buildsPath') || 'build';
  }

  static get buildMethod() {
    return Input.getInput('buildMethod') || ''; // processed in docker file
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
    const input = Input.getInput('androidAppBundle') || false;

    return input === 'true';
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

  static get allowDirtyBuild() {
    const input = Input.getInput('allowDirtyBuild') || false;

    return input === 'true';
  }

  static get customParameters() {
    return Input.getInput('customParameters') || '';
  }

  static get sshAgent() {
    return Input.getInput('sshAgent') || '';
  }

  static get chownFilesTo() {
    return Input.getInput('chownFilesTo') || '';
  }

  static get postBuildSteps() {
    return Input.getInput('postBuildSteps') || '';
  }

  static get preBuildSteps() {
    return Input.getInput('preBuildSteps') || '';
  }

  static get customBuildSteps() {
    return Input.getInput('customBuildSteps') || '';
  }

  static get cloudRunnerCluster() {
    return Input.getInput('cloudRunnerCluster') || '';
  }

  static get awsBaseStackName() {
    return Input.getInput('awsBaseStackName') || 'game-ci-3-test';
  }

  static get kubeConfig() {
    return Input.getInput('kubeConfig') || '';
  }

  static get githubToken() {
    return Input.getInput('githubToken') || '';
  }

  static get cloudRunnerMemory() {
    return Input.getInput('cloudRunnerMemory') || '750M';
  }

  static get cloudRunnerCpu() {
    return Input.getInput('cloudRunnerCpu') || '1.0';
  }

  static get kubeVolumeSize() {
    return Input.getInput('kubeVolumeSize') || '5Gi';
  }

  static get kubeVolume() {
    return Input.getInput('kubeVolume') || '';
  }
}

export default Input;
