import { fsSync as fs, path, core } from '../dependencies.ts';
import { Cli } from './cli/cli.ts';
import CloudRunnerQueryOverride from './cloud-runner/services/cloud-runner-query-override.ts';
import Platform from './platform.ts';
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

  public static githubInputEnabled: boolean = true;

  // Todo - Note that this is now invoked both statically and dynamically - which is a temporary mess.
  public getInput(query: string) {
    if (this && this.arguments) {
      const value = this.arguments.get(query);

      if (log.isVeryVerbose) log.debug('arg', query, '=', value);

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
    return this.getInput('region') || 'eu-west-2';
  }

  public get githubRepo() {
    return this.getInput('GITHUB_REPOSITORY') || this.getInput('GITHUB_REPO') || undefined;
  }

  public get branch() {
    if (this.getInput(`GITHUB_REF`)) {
      return this.getInput(`GITHUB_REF`).replace('refs/', '').replace(`head/`, '').replace(`heads/`, '');
    } else if (this.getInput('branch')) {
      return this.getInput('branch').replace('/head', '');
    } else {
      return '';
    }
  }

  public get cloudRunnerBuilderPlatform() {
    const input = this.getInput('cloudRunnerBuilderPlatform');
    if (input) {
      return input;
    }
    if (Input.cloudRunnerCluster !== 'local') {
      return 'linux';
    }

    return;
  }

  public get gitSha() {
    if (this.getInput(`GITHUB_SHA`)) {
      return this.getInput(`GITHUB_SHA`);
    } else if (this.getInput(`GitSHA`)) {
      return this.getInput(`GitSHA`);
    }
  }

  public get runNumber() {
    return this.getInput('GITHUB_RUN_NUMBER') || '0';
  }

  public get targetPlatform() {
    return this.getInput('targetPlatform') || Platform.default;
  }

  public get unityVersion() {
    return this.getInput('unityVersion') || 'auto';
  }

  public get customImage() {
    return this.getInput('customImage') || '';
  }

  public get projectPath() {
    let input = this.getInput('projectPath');

    // Todo - remove hardcoded test project reference
    const isTestProject =
      fs.existsSync(path.join('test-project', 'ProjectSettings', 'ProjectVersion.txt')) &&
      !fs.existsSync(path.join('ProjectSettings', 'ProjectVersion.txt'));
    if (!input && isTestProject) input = 'test-project';

    if (!input) input = '.';

    return input.replace(/\/$/, '');
  }

  public get buildName() {
    return this.getInput('buildName') || this.targetPlatform;
  }

  public get buildsPath() {
    return this.getInput('buildsPath') || 'build';
  }

  public get buildMethod() {
    return this.getInput('buildMethod') || ''; // Processed in docker file
  }

  public get customParameters() {
    return this.getInput('customParameters') || '';
  }

  public get versioningStrategy() {
    return this.getInput('versioning') || 'Semantic';
  }

  public get specifiedVersion() {
    return this.getInput('version') || '';
  }

  public get androidVersionCode() {
    return this.getInput('androidVersionCode');
  }

  public get androidAppBundle() {
    const input = this.getInput('androidAppBundle') || false;

    return input === 'true';
  }

  public get androidKeystoreName() {
    return this.getInput('androidKeystoreName') || '';
  }

  public get androidKeystoreBase64() {
    return this.getInput('androidKeystoreBase64') || '';
  }

  public get androidKeystorePass() {
    return this.getInput('androidKeystorePass') || '';
  }

  public get androidKeyaliasName() {
    return this.getInput('androidKeyaliasName') || '';
  }

  public get androidKeyaliasPass() {
    return this.getInput('androidKeyaliasPass') || '';
  }

  public get androidTargetSdkVersion() {
    return this.getInput('androidTargetSdkVersion') || '';
  }

  public get sshAgent() {
    return this.getInput('sshAgent') || '';
  }

  public get gitPrivateToken() {
    return core.getInput('gitPrivateToken') || false;
  }

  public get customJob() {
    return this.getInput('customJob') || '';
  }

  public customJobHooks() {
    return this.getInput('customJobHooks') || '';
  }

  public cachePushOverrideCommand() {
    return this.getInput('cachePushOverrideCommand') || '';
  }

  public cachePullOverrideCommand() {
    return this.getInput('cachePullOverrideCommand') || '';
  }

  public readInputFromOverrideList() {
    return this.getInput('readInputFromOverrideList') || '';
  }

  public readInputOverrideCommand() {
    return this.getInput('readInputOverrideCommand') || '';
  }

  public get cloudRunnerBranch() {
    return this.getInput('cloudRunnerBranch') || 'cloud-runner-develop';
  }

  public get chownFilesTo() {
    return this.getInput('chownFilesTo') || '';
  }

  public get allowDirtyBuild() {
    const input = this.getInput('allowDirtyBuild');
    log.debug('input === ', input);

    return input || false === true;
  }

  public get postBuildSteps() {
    return this.getInput('postBuildSteps') || '';
  }

  public get preBuildSteps() {
    return this.getInput('preBuildSteps') || '';
  }

  public get awsBaseStackName() {
    return this.getInput('awsBaseStackName') || 'game-ci';
  }

  public get cloudRunnerCluster() {
    if (Cli.isCliMode) {
      return this.getInput('cloudRunnerCluster') || 'aws';
    }

    return this.getInput('cloudRunnerCluster') || 'local';
  }

  public get cloudRunnerCpu() {
    return this.getInput('cloudRunnerCpu');
  }

  public get cloudRunnerMemory() {
    return this.getInput('cloudRunnerMemory');
  }

  public get kubeConfig() {
    return this.getInput('kubeConfig') || '';
  }

  public get kubeVolume() {
    return this.getInput('kubeVolume') || '';
  }

  public get kubeVolumeSize() {
    return this.getInput('kubeVolumeSize') || '5Gi';
  }

  public get kubeStorageClass(): string {
    return this.getInput('kubeStorageClass') || '';
  }

  public get checkDependencyHealthOverride(): string {
    return this.getInput('checkDependencyHealthOverride') || '';
  }

  public get startDependenciesOverride(): string {
    return this.getInput('startDependenciesOverride') || '';
  }

  public get cacheKey(): string {
    return this.getInput('cacheKey') || Input.branch;
  }

  public get cloudRunnerTests(): boolean {
    return this.getInput(`cloudRunnerTests`) || false;
  }

  public static toEnvVarFormat(input: string) {
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
