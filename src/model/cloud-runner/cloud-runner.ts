import AWSBuildPlatform from './aws-build-platform';
import * as core from '@actions/core';
import { BuildParameters } from '..';
import CloudRunnerNamespace from './cloud-runner-namespace';
import CloudRunnerSecret from './cloud-runner-secret';
import { CloudRunnerProviderInterface } from './cloud-runner-provider-interface';
import Kubernetes from './kubernetes-build-platform';
import CloudRunnerEnvironmentVariable from './cloud-runner-environment-variable';
import ImageEnvironmentFactory from '../image-environment-factory';
import YAML from 'yaml';
import CloudRunnerLogger from './cloud-runner-logger';
const repositoryFolder = 'repo';
const buildVolumeFolder = 'data';
const cacheFolder = 'cache';

class CloudRunner {
  static CloudRunnerProviderPlatform: CloudRunnerProviderInterface;
  private static buildParams: BuildParameters;
  private static defaultSecrets: CloudRunnerSecret[];
  private static buildGuid: string;
  private static branchName: string;
  private static buildPathFull: string;
  private static builderPathFull: string;
  private static steamPathFull: string;
  private static repoPathFull: string;
  private static projectPathFull: string;
  private static libraryFolderFull: string;
  private static cacheFolderFull: string;
  private static lfsDirectory: string;
  private static purgeRemoteCaching: boolean;
  private static CloudRunnerBranch: string;
  private static unityBuilderRepoUrl: string;
  private static targetBuildRepoUrl: string;
  private static readonly defaultGitShaEnvironmentVariable = [
    {
      name: 'GITHUB_SHA',
      value: process.env.GITHUB_SHA || '',
    },
  ];

  private static setup(buildParameters: BuildParameters) {
    CloudRunnerLogger.setup();
    CloudRunner.buildGuid = CloudRunnerNamespace.generateBuildName(
      CloudRunner.readRunNumber(),
      buildParameters.platform,
    );
    CloudRunner.buildParams = buildParameters;
    CloudRunner.setupBranchName();
    CloudRunner.setupFolderVariables();
    CloudRunner.setupDefaultSecrets();
    CloudRunner.setupBuildPlatform();
  }

  private static setupFolderVariables() {
    this.buildPathFull = `/${buildVolumeFolder}/${this.buildGuid}`;
    this.builderPathFull = `${this.buildPathFull}/builder`;
    this.steamPathFull = `${this.buildPathFull}/steam`;
    this.repoPathFull = `${this.buildPathFull}/${repositoryFolder}`;
    this.projectPathFull = `${this.repoPathFull}/${this.buildParams.projectPath}`;
    this.libraryFolderFull = `${this.projectPathFull}/Library`;
    this.cacheFolderFull = `/${buildVolumeFolder}/${cacheFolder}/${this.branchName}`;
    this.lfsDirectory = `${this.repoPathFull}/.git/lfs`;
    this.purgeRemoteCaching = process.env.PURGE_REMOTE_BUILDER_CACHE !== undefined;
    this.CloudRunnerBranch = process.env.CloudRunnerBranch ? `--branch "${process.env.CloudRunnerBranch}"` : '';
    this.unityBuilderRepoUrl = `https://${this.buildParams.githubToken}@github.com/game-ci/unity-builder.git`;
    this.targetBuildRepoUrl = `https://${this.buildParams.githubToken}@github.com/${process.env.GITHUB_REPOSITORY}.git`;
  }

  private static getHandleCachingCommand() {
    return `${this.builderPathFull}/dist/cloud-runner/handleCaching.sh "${this.cacheFolderFull}" "${this.libraryFolderFull}" "${this.lfsDirectory}" "${this.purgeRemoteCaching}"`;
  }

  private static getCloneNoLFSCommand() {
    return `${this.builderPathFull}/dist/cloud-runner/cloneNoLFS.sh "${this.repoPathFull}" "${this.targetBuildRepoUrl}"`;
  }

  private static getCloneBuilder() {
    return `git clone -q ${this.CloudRunnerBranch} ${this.unityBuilderRepoUrl} ${this.builderPathFull}`;
  }

  static async run(buildParameters: BuildParameters, baseImage) {
    CloudRunner.setup(buildParameters);
    try {
      await CloudRunner.setupSharedBuildResources();
      await CloudRunner.setupStep();
      await CloudRunner.runMainJob(baseImage);
      await CloudRunner.cleanupSharedBuildResources();
    } catch (error) {
      await CloudRunner.handleException(error);
      throw error;
    }
  }

  private static async setupSharedBuildResources() {
    await this.CloudRunnerProviderPlatform.setupSharedBuildResources(
      this.buildGuid,
      this.buildParams,
      this.branchName,
      this.defaultSecrets,
    );
  }

  private static setupBuildPlatform() {
    switch (this.buildParams.cloudRunnerCluster) {
      case 'aws':
        CloudRunnerLogger.log('Building with AWS');
        this.CloudRunnerProviderPlatform = new AWSBuildPlatform(this.buildParams);
        break;
      default:
      case 'k8s':
        CloudRunnerLogger.log('Building with Kubernetes');
        this.CloudRunnerProviderPlatform = new Kubernetes(this.buildParams);
        break;
    }
  }

  private static readRunNumber() {
    const runNumber = process.env.GITHUB_RUN_NUMBER;
    if (!runNumber || runNumber === '') {
      throw new Error('no run number found, exiting');
    }
    return runNumber;
  }

  private static setupBranchName() {
    const defaultBranchName =
      process.env.GITHUB_REF?.split('/')
        .filter((x) => {
          x = x[0].toUpperCase() + x.slice(1);
          return x;
        })
        .join('') || '';
    this.branchName =
      process.env.REMOTE_BUILDER_CACHE !== undefined ? process.env.REMOTE_BUILDER_CACHE : defaultBranchName;
  }

  private static setupDefaultSecrets() {
    this.defaultSecrets = [
      {
        ParameterKey: 'GithubToken',
        EnvironmentVariable: 'GITHUB_TOKEN',
        ParameterValue: this.buildParams.githubToken,
      },
      {
        ParameterKey: 'branch',
        EnvironmentVariable: 'branch',
        ParameterValue: this.branchName,
      },
      {
        ParameterKey: 'buildPathFull',
        EnvironmentVariable: 'buildPathFull',
        ParameterValue: this.buildPathFull,
      },
      {
        ParameterKey: 'projectPathFull',
        EnvironmentVariable: 'projectPathFull',
        ParameterValue: this.projectPathFull,
      },
      {
        ParameterKey: 'libraryFolderFull',
        EnvironmentVariable: 'libraryFolderFull',
        ParameterValue: this.libraryFolderFull,
      },
      {
        ParameterKey: 'builderPathFull',
        EnvironmentVariable: 'builderPathFull',
        ParameterValue: this.builderPathFull,
      },
      {
        ParameterKey: 'repoPathFull',
        EnvironmentVariable: 'repoPathFull',
        ParameterValue: this.repoPathFull,
      },
      {
        ParameterKey: 'steamPathFull',
        EnvironmentVariable: 'steamPathFull',
        ParameterValue: this.steamPathFull,
      },
    ];
    this.defaultSecrets.push(
      ...ImageEnvironmentFactory.getEnvironmentVariables(this.buildParams).map((x) => {
        return {
          ParameterKey: x.name,
          EnvironmentVariable: x.name,
          ParameterValue: x.value,
        };
      }),
    );
  }

  private static readBuildEnvironmentVariables(): CloudRunnerEnvironmentVariable[] {
    return [
      {
        name: 'ContainerMemory',
        value: this.buildParams.cloudRunnerMemory,
      },
      {
        name: 'ContainerCpu',
        value: this.buildParams.cloudRunnerCpu,
      },
      {
        name: 'GITHUB_WORKSPACE',
        value: `/${buildVolumeFolder}/${this.buildGuid}/${repositoryFolder}/`,
      },
      {
        name: 'PROJECT_PATH',
        value: this.buildParams.projectPath,
      },
      {
        name: 'BUILD_PATH',
        value: this.buildParams.buildPath,
      },
      {
        name: 'BUILD_FILE',
        value: this.buildParams.buildFile,
      },
      {
        name: 'BUILD_NAME',
        value: this.buildParams.buildName,
      },
      {
        name: 'BUILD_METHOD',
        value: this.buildParams.buildMethod,
      },
      {
        name: 'CUSTOM_PARAMETERS',
        value: this.buildParams.customParameters,
      },
      {
        name: 'BUILD_TARGET',
        value: this.buildParams.platform,
      },
      {
        name: 'ANDROID_VERSION_CODE',
        value: this.buildParams.androidVersionCode.toString(),
      },
      {
        name: 'ANDROID_KEYSTORE_NAME',
        value: this.buildParams.androidKeystoreName,
      },
      {
        name: 'ANDROID_KEYALIAS_NAME',
        value: this.buildParams.androidKeyaliasName,
      },
    ];
  }

  private static async runMainJob(baseImage: any) {
    if (this.buildParams.customBuildSteps !== '') {
      CloudRunnerLogger.log(`Cloud Runner is running in standard build automation mode`);
      await CloudRunner.standardBuildAutomation(baseImage);
    } else {
      CloudRunnerLogger.log(`Cloud Runner is running in custom job mode`);
      await CloudRunner.runCustomJob(this.buildParams.customBuildSteps);
    }
  }

  private static async standardBuildAutomation(baseImage: any) {
    CloudRunnerLogger.logWithTime('Pre build steps time');
    await this.runCustomJob(this.buildParams.preBuildSteps);
    CloudRunnerLogger.logWithTime('Setup time');
    await CloudRunner.BuildStep(baseImage);
    CloudRunnerLogger.logWithTime('Build time');
    await CloudRunner.CompressionStep();
    CloudRunnerLogger.logWithTime('Compression time');
    await this.runCustomJob(this.buildParams.postBuildSteps);
    CloudRunnerLogger.logWithTime('Post build steps time');
  }

  private static async runCustomJob(buildSteps) {
    buildSteps = YAML.parse(buildSteps);
    for (const step of buildSteps) {
      const stepSecrets: CloudRunnerSecret[] = step.secrets.map((x) => {
        const secret: CloudRunnerSecret = {
          ParameterKey: x.name,
          EnvironmentVariable: x.name,
          ParameterValue: x.value,
        };
        return secret;
      });
      await this.CloudRunnerProviderPlatform.runBuildTask(
        this.buildGuid,
        step['image'],
        step['commands'],
        `/${buildVolumeFolder}`,
        `/${buildVolumeFolder}`,
        this.defaultGitShaEnvironmentVariable,
        [...this.defaultSecrets, ...stepSecrets],
      );
    }
  }

  private static async setupStep() {
    CloudRunnerLogger.log('Starting step 1/4 clone and restore cache)');
    await this.CloudRunnerProviderPlatform.runBuildTask(
      this.buildGuid,
      'alpine/git',
      [
        ` printenv
          apk update -q
          apk add unzip zip git-lfs jq tree -q
          mkdir -p ${this.buildPathFull}
          mkdir -p ${this.builderPathFull}
          mkdir -p ${this.repoPathFull}
          ${this.getCloneBuilder()}
          echo ' '
          echo 'Initializing source repository for cloning with caching of LFS files'
          ${this.getCloneNoLFSCommand()}
          echo 'Source repository initialized'
          echo ' '
          echo 'Starting checks of cache for the Unity project Library and git LFS files'
          ${this.getHandleCachingCommand()}
      `,
      ],
      `/${buildVolumeFolder}`,
      `/${buildVolumeFolder}/`,
      CloudRunner.defaultGitShaEnvironmentVariable,
      this.defaultSecrets,
    );
  }

  private static async BuildStep(baseImage: any) {
    CloudRunnerLogger.log('Starting part 2/4 (build unity project)');
    await this.CloudRunnerProviderPlatform.runBuildTask(
      this.buildGuid,
      baseImage.toString(),
      [
        `
            printenv
            export GITHUB_WORKSPACE="${this.repoPathFull}"
            cp -r "${this.builderPathFull}/dist/default-build-script/" "/UnityBuilderAction"
            cp -r "${this.builderPathFull}/dist/entrypoint.sh" "/entrypoint.sh"
            cp -r "${this.builderPathFull}/dist/steps/" "/steps"
            chmod -R +x "/entrypoint.sh"
            chmod -R +x "/steps"
            /entrypoint.sh
            ${process.env.DEBUG ? '' : '#'}tree -L 4 "${this.buildPathFull}"
            ${process.env.DEBUG ? '' : '#'}ls -lh "/${buildVolumeFolder}"
          `,
      ],
      `/${buildVolumeFolder}`,
      `/${this.projectPathFull}`,
      CloudRunner.readBuildEnvironmentVariables(),
      this.defaultSecrets,
    );
  }

  private static async CompressionStep() {
    CloudRunnerLogger.log('Starting step 3/4 build compression');
    // Cleanup
    await this.CloudRunnerProviderPlatform.runBuildTask(
      this.buildGuid,
      'alpine',
      [
        `
            printenv
            apk update -q
            apk add zip tree -q
            ${process.env.DEBUG ? '' : '#'}tree -L 4 "$repoPathFull"
            ${process.env.DEBUG ? '' : '#'}ls -lh "$repoPathFull"
            cd "$libraryFolderFull/.."
            zip -r "lib-$BUILDID.zip" "./Library"
            mv "lib-$BUILDID.zip" "/$cacheFolderFull/lib"
            cd "$repoPathFull"
            ls -lh "$repoPathFull"
            zip -r "build-$BUILDID.zip" "./${CloudRunner.buildParams.buildPath}"
            mv "build-$BUILDID.zip" "/$cacheFolderFull/build-$BUILDID.zip"
            ${process.env.DEBUG ? '' : '#'}tree -L 4 "/$cacheFolderFull"
            ${process.env.DEBUG ? '' : '#'}tree -L 4 "/$cacheFolderFull/.."
            ${process.env.DEBUG ? '' : '#'}tree -L 4 "$repoPathFull"
            ${process.env.DEBUG ? '' : '#'}ls -lh "$repoPathFull"
          `,
      ],
      `/${buildVolumeFolder}`,
      `/${buildVolumeFolder}`,
      [
        ...CloudRunner.defaultGitShaEnvironmentVariable,
        ...[
          {
            name: 'cacheFolderFull',
            value: this.cacheFolderFull,
          },
        ],
      ],
      this.defaultSecrets,
    );
    CloudRunnerLogger.log('compression step complete');
  }

  private static async cleanupSharedBuildResources() {
    await this.CloudRunnerProviderPlatform.cleanupSharedBuildResources(
      this.buildGuid,
      this.buildParams,
      this.branchName,
      this.defaultSecrets,
    );
  }

  private static async handleException(error: unknown) {
    CloudRunnerLogger.error(JSON.stringify(error, undefined, 4));
    core.setFailed('Remote Builder failed');
    await this.CloudRunnerProviderPlatform.cleanupSharedBuildResources(
      this.buildGuid,
      this.buildParams,
      this.branchName,
      this.defaultSecrets,
    );
  }
}
export default CloudRunner;
