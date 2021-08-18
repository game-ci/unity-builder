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
  static SteamDeploy: boolean = process.env.STEAM_DEPLOY !== undefined || false;
  private static readonly defaultGitShaEnvironmentVariable = [
    {
      name: 'GITHUB_SHA',
      value: process.env.GITHUB_SHA || '',
    },
  ];

  static async build(buildParameters: BuildParameters, baseImage) {
    const t = Date.now();
    CloudRunner.buildGuid = CloudRunnerNamespace.generateBuildName(
      CloudRunner.readRunNumber(),
      buildParameters.platform,
    );
    CloudRunner.buildParams = buildParameters;
    CloudRunner.setupBranchName();
    CloudRunner.setupFolderVariables();
    CloudRunner.setupDefaultSecrets();
    try {
      CloudRunner.setupBuildPlatform();
      await this.CloudRunnerProviderPlatform.setupSharedBuildResources(
        this.buildGuid,
        this.buildParams,
        this.branchName,
        this.defaultSecrets,
      );
      await CloudRunner.SetupStep();
      const t2 = Date.now();
      core.info(`Setup time: ${Math.floor((t2 - t) / 1000)}s`);
      await CloudRunner.BuildStep(baseImage);
      const t3 = Date.now();
      core.info(`Build time: ${Math.floor((t3 - t2) / 1000)}s`);
      await CloudRunner.CompressionStep();
      core.info(`Post build steps ${this.buildParams.postBuildSteps}`);
      this.buildParams.postBuildSteps = YAML.parse(this.buildParams.postBuildSteps);
      core.info(`Post build steps ${JSON.stringify(this.buildParams.postBuildSteps, undefined, 4)}`);
      for (const step of this.buildParams.postBuildSteps) {
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
          [
            {
              name: 'GITHUB_SHA',
              value: process.env.GITHUB_SHA || '',
            },
          ],
          [...this.defaultSecrets, ...stepSecrets],
        );
      }
      await this.CloudRunnerProviderPlatform.cleanupSharedBuildResources(
        this.buildGuid,
        this.buildParams,
        this.branchName,
        this.defaultSecrets,
      );
    } catch (error) {
      await CloudRunner.handleException(error);
      throw error;
    }
  }

  private static setupFolderVariables() {
    this.buildPathFull = `/${buildVolumeFolder}/${this.buildGuid}`;
    this.builderPathFull = `${this.buildPathFull}/builder`;
    this.steamPathFull = `${this.buildPathFull}/steam`;
    this.repoPathFull = `${this.buildPathFull}/${repositoryFolder}`;
    this.projectPathFull = `${this.repoPathFull}/${this.buildParams.projectPath}`;
    this.libraryFolderFull = `${this.projectPathFull}/Library`;
    this.cacheFolderFull = `/${buildVolumeFolder}/${cacheFolder}/${this.branchName}`;
  }

  private static async SetupStep() {
    core.info('Starting step 1/4 clone and restore cache)');

    const lfsDirectory = `${this.repoPathFull}/.git/lfs`;
    const testLFSFile = `${this.projectPathFull}/Assets/LFS_Test_File.jpg`;

    const unityBuilderRepoUrl = `https://${this.buildParams.githubToken}@github.com/game-ci/unity-builder.git`;
    const targetBuildRepoUrl = `https://${this.buildParams.githubToken}@github.com/${process.env.GITHUB_REPOSITORY}.git`;

    const purgeRemoteCache = process.env.PURGE_REMOTE_BUILDER_CACHE !== undefined;
    const initializeSourceRepoForCaching = `${this.builderPathFull}/dist/cloud-runner/cloneNoLFS.sh "${this.repoPathFull}" "${targetBuildRepoUrl}" "${testLFSFile}"`;
    const handleCaching = `${this.builderPathFull}/dist/cloud-runner/handleCaching.sh "${this.cacheFolderFull}" "${this.libraryFolderFull}" "${lfsDirectory}" "${purgeRemoteCache}"`;
    const CloudRunnerBranch = process.env.CloudRunnerBranch ? `--branch "${process.env.CloudRunnerBranch}"` : '';
    const cloneCloudRunner = `git clone -q ${CloudRunnerBranch} ${unityBuilderRepoUrl} ${this.builderPathFull}`;
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
          ${cloneCloudRunner}
          echo ' '
          echo 'Initializing source repository for cloning with caching of LFS files'
          ${initializeSourceRepoForCaching}
          echo 'Source repository initialized'
          echo ' '
          ${process.env.DEBUG ? '' : '#'}echo $LFS_ASSETS_HASH
          ${process.env.DEBUG ? '' : '#'}echo 'Large File before LFS caching and pull'
          ${process.env.DEBUG ? '' : '#'}ls -alh "${lfsDirectory}"
          ${process.env.DEBUG ? '' : '#'}echo ' '
          echo 'Starting checks of cache for the Unity project Library and git LFS files'
          ${handleCaching}
          ${process.env.DEBUG ? '' : '#'}echo 'Caching complete'
          ${process.env.DEBUG ? '' : '#'}echo ' '
          ${process.env.DEBUG ? '' : '#'}echo 'Large File after LFS caching and pull'
          ${process.env.DEBUG ? '' : '#'}ls -alh "${lfsDirectory}"
          ${process.env.DEBUG ? '' : '#'}echo ' '
          ${process.env.DEBUG ? '' : '#'}tree -L 4 "${this.buildPathFull}"
          ${process.env.DEBUG ? '' : '#'}ls -lh "/${buildVolumeFolder}"
          ${process.env.DEBUG ? '' : '#'}echo ' '
      `,
      ],
      `/${buildVolumeFolder}`,
      `/${buildVolumeFolder}/`,
      CloudRunner.defaultGitShaEnvironmentVariable,
      this.defaultSecrets,
    );
  }

  private static async BuildStep(baseImage: any) {
    core.info('Starting part 2/4 (build unity project)');
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
    core.info('Starting step 3/4 build compression');
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
            cd "$libraryFolderFull"
            zip -r "lib-$BUILDID.zip" "$libraryFolderFull"
            mv "lib-$BUILDID.zip" "$cacheFolderFull/lib"
            cd "$repoPathFull"
            ls -lh "$repoPathFull"
            zip -r "build-$BUILDID.zip" "$repoPathFull/${CloudRunner.buildParams.buildPath}"
            mv "build-$BUILDID.zip" "/$cacheFolderFull/build-$BUILDID.zip"
            ${process.env.DEBUG ? '' : '#'}tree -L 4 "$repoPathFull"
            ${process.env.DEBUG ? '' : '#'}ls -lh "$repoPathFull"
          `,
      ],
      `/${buildVolumeFolder}`,
      `/${buildVolumeFolder}`,
      [
        {
          name: 'GITHUB_SHA',
          value: process.env.GITHUB_SHA || '',
        },
      ],
      this.defaultSecrets,
    );
    core.info('compression step complete');
  }

  private static setupBuildPlatform() {
    switch (this.buildParams.cloudRunnerCluster) {
      case 'aws':
        core.info('Building with AWS');
        this.CloudRunnerProviderPlatform = new AWSBuildPlatform(this.buildParams);
        break;
      default:
      case 'k8s':
        core.info('Building with Kubernetes');
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

  private static readUploadArtifactEnvironmentVariables() {
    return [
      {
        name: 'GITHUB_SHA',
        value: process.env.GITHUB_SHA || '',
      },
      {
        name: 'AWS_DEFAULT_REGION',
        value: process.env.AWS_DEFAULT_REGION || '',
      },
    ];
  }

  private static async handleException(error: unknown) {
    core.error(JSON.stringify(error, undefined, 4));
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
