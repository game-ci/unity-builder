import { fsSync as fs, path, core } from '../dependencies.ts';
import { Cli } from './cli/cli.ts';
import CloudRunnerQueryOverride from './cloud-runner/services/cloud-runner-query-override.ts';
import { CliArguments } from '../core/cli/cli-arguments.ts';

/**
 * Input variables specified directly on the commandline.
 *
 * Todo - check if the following statement is still correct:
 * Note that input is always passed as a string, even booleans.
 *
 * Todo: rename to UserInput and remove anything that is not direct input from the user / ci workflow
 */
class Input {
  private readonly arguments: CliArguments;

  constructor(argumentsFromCli: CliArguments) {
    this.arguments = argumentsFromCli;

    return this;
  }

  // Todo - read something from environment instead and make that into a parameter, then use that.
  public static githubInputEnabled: boolean = true;

  // Todo - Note that this is now invoked both statically and dynamically - which is a temporary mess.
  public get(query: string) {
    if (this && this.arguments) {
      return this.arguments.get(query);
    }

    // Legacy (static)
    log.warn(`Querying static`);
    if (Input.githubInputEnabled) {
      const coreInput = core.getInput(query);
      if (coreInput && coreInput !== '') {
        return coreInput;
      }
    }
    const alternativeQuery = Input.toEnvVarFormat(query);

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

  public get region(): string {
    return this.get('region');
  }

  public get githubRepo() {
    return this.get('GITHUB_REPOSITORY') || this.get('GITHUB_REPO') || undefined;
  }

  public get branch() {
    if (this.get(`GITHUB_REF`)) {
      return this.get(`GITHUB_REF`).replace('refs/', '').replace(`head/`, '').replace(`heads/`, '');
    } else if (this.get('branch')) {
      return this.get('branch').replace('/head', '');
    } else {
      return '';
    }
  }

  public get cloudRunnerBuilderPlatform() {
    const input = this.get('cloudRunnerBuilderPlatform');
    if (input) {
      return input;
    }
    if (Input.cloudRunnerCluster !== 'local') {
      return 'linux';
    }

    return;
  }

  public get gitSha() {
    if (this.get(`GITHUB_SHA`)) {
      return this.get(`GITHUB_SHA`);
    } else if (this.get(`GitSHA`)) {
      return this.get(`GitSHA`);
    }
  }

  public get runNumber() {
    return this.get('GITHUB_RUN_NUMBER') || '0';
  }

  public get unitySerial() {
    return this.get('unitySerial') || '';
  }

  public get projectPath() {
    let input = this.get('projectPath');

    // Todo - remove hardcoded test project reference
    const isTestProject =
      fs.existsSync(path.join('test-project', 'ProjectSettings', 'ProjectVersion.txt')) &&
      !fs.existsSync(path.join('ProjectSettings', 'ProjectVersion.txt'));
    if (!input && isTestProject) input = 'test-project';

    if (!input) input = '.';

    return input.replace(/\/$/, '');
  }

  public get buildName() {
    return this.get('buildName');
  }

  public get buildMethod() {
    return this.get('buildMethod') || ''; // Processed in docker file
  }

  public get customParameters() {
    return this.get('customParameters') || '';
  }

  public get androidVersionCode() {
    return this.get('androidVersionCode');
  }

  public get androidAppBundle() {
    const input = this.get('androidAppBundle') || false;

    return input === 'true';
  }

  public get androidKeystoreName() {
    return this.get('androidKeystoreName') || '';
  }

  public get androidKeystoreBase64() {
    return this.get('androidKeystoreBase64') || '';
  }

  public get androidKeystorePass() {
    return this.get('androidKeystorePass') || '';
  }

  public get androidKeyaliasName() {
    return this.get('androidKeyaliasName') || '';
  }

  public get androidKeyaliasPass() {
    return this.get('androidKeyaliasPass') || '';
  }

  public get androidTargetSdkVersion() {
    return this.get('androidTargetSdkVersion') || '';
  }

  public get sshAgent() {
    return this.get('sshAgent') || '';
  }

  public get gitPrivateToken() {
    return this.get('gitPrivateToken') || '';
  }

  public get customJob() {
    return this.get('customJob') || '';
  }

  public customJobHooks() {
    return this.get('customJobHooks') || '';
  }

  public cachePushOverrideCommand() {
    return this.get('cachePushOverrideCommand') || '';
  }

  public cachePullOverrideCommand() {
    return this.get('cachePullOverrideCommand') || '';
  }

  public readInputFromOverrideList() {
    return this.get('readInputFromOverrideList') || '';
  }

  public readInputOverrideCommand() {
    return this.get('readInputOverrideCommand') || '';
  }

  public get cloudRunnerBranch() {
    return this.get('cloudRunnerBranch') || 'cloud-runner-develop';
  }

  public get chownFilesTo() {
    return this.get('chownFilesTo') || '';
  }

  public get postBuildSteps() {
    return this.get('postBuildSteps') || '';
  }

  public get preBuildSteps() {
    return this.get('preBuildSteps') || '';
  }

  public get awsBaseStackName() {
    return this.get('awsBaseStackName') || 'game-ci';
  }

  public get cloudRunnerCpu() {
    return this.get('cloudRunnerCpu');
  }

  public get cloudRunnerMemory() {
    return this.get('cloudRunnerMemory');
  }

  public get kubeConfig() {
    return this.get('kubeConfig') || '';
  }

  public get kubeVolume() {
    return this.get('kubeVolume') || '';
  }

  public get kubeVolumeSize() {
    return this.get('kubeVolumeSize') || '5Gi';
  }

  public get kubeStorageClass(): string {
    return this.get('kubeStorageClass') || '';
  }

  public get checkDependencyHealthOverride(): string {
    return this.get('checkDependencyHealthOverride') || '';
  }

  public get startDependenciesOverride(): string {
    return this.get('startDependenciesOverride') || '';
  }

  public get cacheKey(): string {
    return this.get('cacheKey') || Input.branch;
  }

  public get cloudRunnerTests(): boolean {
    return this.get(`cloudRunnerTests`) || false;
  }

  /**
   * @deprecated Use Parameter.toEnvFormat
   */
  public static toEnvVarFormat(input: string) {
    if (input.toUpperCase() === input) return input;

    return input.replace(/([\da-z])([A-Z])/g, '$1_$2').toUpperCase();
  }
}

export default Input;
