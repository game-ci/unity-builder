import { CommandInterface } from '../command-interface.ts';
import { Options } from '../../../config/options.ts';
import { CloudRunner, ImageTag, Input, Output } from '../../../model/index.ts';
import { core, nanoid } from '../../../dependencies.ts';
import Parameters from '../../../model/parameters.ts';
import { GitRepoReader } from '../../../model/input-readers/git-repo.ts';
import { Cli } from '../../../model/cli/cli.ts';
import CloudRunnerConstants from '../../../model/cloud-runner/services/cloud-runner-constants.ts';
import CloudRunnerBuildGuid from '../../../model/cloud-runner/services/cloud-runner-guid.ts';
import { GithubCliReader } from '../../../model/input-readers/github-cli.ts';
import { CommandBase } from './command-base.ts';

// Todo - Verify this entire flow
export class BuildRemoteCommand extends CommandBase implements CommandInterface {
  public async validate() {
    await super.validate();
  }

  public async parseParameters(input: Input, parameters: Parameters): Promise<Partial<Parameters>> {
    const cloudRunnerCluster = Cli.isCliMode
      ? this.input.getInput('cloudRunnerCluster') || 'aws'
      : this.input.getInput('cloudRunnerCluster') || 'local';

    return {
      cloudRunnerCluster,
      cloudRunnerBranch: input.cloudRunnerBranch.split('/').reverse()[0],
      cloudRunnerIntegrationTests: input.cloudRunnerTests,
      githubRepo: input.githubRepo || (await GitRepoReader.GetRemote()) || 'game-ci/unity-builder',
      gitPrivateToken: parameters.gitPrivateToken || (await GithubCliReader.GetGitHubAuthToken()),
      isCliMode: Cli.isCliMode,
      awsStackName: input.awsBaseStackName,
      cloudRunnerBuilderPlatform: input.cloudRunnerBuilderPlatform,
      awsBaseStackName: input.awsBaseStackName,
      kubeConfig: input.kubeConfig,
      cloudRunnerMemory: input.cloudRunnerMemory,
      cloudRunnerCpu: input.cloudRunnerCpu,
      kubeVolumeSize: input.kubeVolumeSize,
      kubeVolume: input.kubeVolume,
      postBuildSteps: input.postBuildSteps,
      preBuildSteps: input.preBuildSteps,
      runNumber: input.runNumber,
      gitSha: input.gitSha,
      logId: nanoid.customAlphabet(CloudRunnerConstants.alphabet, 9)(),
      buildGuid: CloudRunnerBuildGuid.generateGuid(input.runNumber, input.targetPlatform),
      customJobHooks: input.customJobHooks(),
      cachePullOverrideCommand: input.cachePullOverrideCommand(),
      cachePushOverrideCommand: input.cachePushOverrideCommand(),
      readInputOverrideCommand: input.readInputOverrideCommand(),
      readInputFromOverrideList: input.readInputFromOverrideList(),
      kubeStorageClass: input.kubeStorageClass,
      checkDependencyHealthOverride: input.checkDependencyHealthOverride,
      startDependenciesOverride: input.startDependenciesOverride,
      cacheKey: input.cacheKey,
    };
  }

  public async execute(options: Options): Promise<boolean> {
    const { buildParameters } = options;
    const baseImage = new ImageTag(buildParameters);

    const result = await CloudRunner.run(buildParameters, baseImage.toString());
    const { status, output } = result;

    await Output.setBuildVersion(buildParameters.buildVersion);

    return status.success;
  }
}
