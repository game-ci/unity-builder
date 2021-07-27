import AWSBuildPlatform from './aws-build-platform';
import * as core from '@actions/core';
import { BuildParameters } from '..';
import RemoteBuilderNamespace from './remote-builder-namespace';
import RemoteBuilderSecret from './remote-builder-secret';
import { RemoteBuilderProviderInterface } from './remote-builder-provider-interface';
import Kubernetes from './kubernetes-build-platform';
const repositoryFolder = 'repo';
const buildVolumeFolder = 'data';
const cacheFolder = 'cache';

class RemoteBuilder {
  static SteamDeploy: boolean = false;
  static RemoteBuilderProviderPlatform: RemoteBuilderProviderInterface;
  static async build(buildParameters: BuildParameters, baseImage) {
    const runNumber = process.env.GITHUB_RUN_NUMBER;
    if (!runNumber || runNumber === '') {
      throw new Error('no run number found, exiting');
    }
    const buildUid = RemoteBuilderNamespace.generateBuildName(runNumber, buildParameters.platform);
    const defaultBranchName =
      process.env.GITHUB_REF?.split('/')
        .filter((x) => {
          x = x[0].toUpperCase() + x.slice(1);
          return x;
        })
        .join('') || '';
    const branchName =
      process.env.REMOTE_BUILDER_CACHE !== undefined ? process.env.REMOTE_BUILDER_CACHE : defaultBranchName;
    this.SteamDeploy = process.env.STEAM_DEPLOY !== undefined || false;
    const token: string = buildParameters.githubToken;
    const defaultSecretsArray = [
      {
        ParameterKey: 'GithubToken',
        EnvironmentVariable: 'GITHUB_TOKEN',
        ParameterValue: token,
      },
    ];
    try {
      switch (buildParameters.remoteBuildCluster) {
        case 'aws':
          core.info('Building with AWS');
          this.RemoteBuilderProviderPlatform = new AWSBuildPlatform(buildParameters);
          break;
        default:
        case 'k8s':
          core.info('Building with Kubernetes');
          this.RemoteBuilderProviderPlatform = new Kubernetes(buildParameters);
          break;
      }
      await this.RemoteBuilderProviderPlatform.setupSharedBuildResources(
        buildUid,
        buildParameters,
        branchName,
        defaultSecretsArray,
      );
      await RemoteBuilder.SetupStep(`setup${buildUid}`, buildParameters, branchName, defaultSecretsArray);
      await RemoteBuilder.BuildStep(`build${buildUid}`, buildParameters, baseImage, defaultSecretsArray);
      await RemoteBuilder.CompressionStep(`compress${buildUid}`, buildParameters, branchName, defaultSecretsArray);
      await RemoteBuilder.UploadArtifacts(`upload${buildUid}`, buildParameters, branchName, defaultSecretsArray);
      if (this.SteamDeploy) {
        await RemoteBuilder.DeployToSteam(buildUid, buildParameters, defaultSecretsArray);
      }
      await this.RemoteBuilderProviderPlatform.cleanupSharedBuildResources(
        buildUid,
        buildParameters,
        branchName,
        defaultSecretsArray,
      );
    } catch (error) {
      core.error(JSON.stringify(error, undefined, 4));
      core.setFailed('Remote Builder failed');
      await this.RemoteBuilderProviderPlatform.cleanupSharedBuildResources(
        buildUid,
        buildParameters,
        branchName,
        defaultSecretsArray,
      );
      throw error;
    }
  }

  private static async SetupStep(
    buildUid: string,
    buildParameters: BuildParameters,
    branchName: string | undefined,
    defaultSecretsArray: RemoteBuilderSecret[],
  ) {
    core.info('Starting step 1/4 clone and restore cache)');
    const cacheFolderFull = `/${buildVolumeFolder}/${cacheFolder}`;
    const buildPathFull = `/${buildVolumeFolder}/${buildUid}`;
    const builderPathFull = `${buildPathFull}/builder`;
    const steamPathFull = `${buildPathFull}/steam`;
    const repoPathFull = `${buildPathFull}/${repositoryFolder}`;
    const projectPathFull = `${repoPathFull}/${buildParameters.projectPath}`;
    const libraryFolderFull = `${projectPathFull}/Library`;

    const repo = `https://${buildParameters.githubToken}@github.com/game-ci/unity-builder.git`;
    const repo2 = `https://${buildParameters.githubToken}@github.com/game-ci/steam-deploy.git`;
    const repo3 = `https://${buildParameters.githubToken}@github.com/${process.env.GITHUB_REPOSITORY}.git`;

    const purgeRemoteCache = process.env.PURGE_REMOTE_BUILDER_CACHE === undefined;
    const cachePullGitLargeFilesAndLibraryFolder = `${builderPathFull}/dist/remote-builder/cachePullLFSAndLibrary.sh ${cacheFolderFull} ${branchName} ${libraryFolderFull} ${purgeRemoteCache}`;
    const cloneRemoteBuilderSourceCommand = `${builderPathFull}/dist/remote-builder/cloneNoLFS.sh ${repoPathFull} ${repo3} $GITHUB_SHA`;
    await this.RemoteBuilderProviderPlatform.runBuildTask(
      buildUid,
      'alpine/git',
      [
        ` apk update
          apk add unzip
          apk add git-lfs
          apk add jq
          apk add sort
          apk add cut
          apk add tree
          #
          mkdir ${buildPathFull}
          mkdir ${builderPathFull}
          mkdir ${repoPathFull}
          mkdir ${steamPathFull}
          #
          echo ' '
          echo "Clone github.com/gameci/unity-builder utility repositories required for building"
          git clone -q --branch "remote-builder/unified-providers" ${repo} ${builderPathFull}
          git clone -q ${repo2} ${steamPathFull}
          #
          echo ' '
          echo 'Cloning utility repositories for remote builder'
          ${cloneRemoteBuilderSourceCommand}
          ${cachePullGitLargeFilesAndLibraryFolder}
          #
          echo ' '
          echo 'Tree for the folder of this specific build:'
          tree -L 3 ${buildPathFull}
          echo ' '
          echo 'Root build volume folder:'
          ls -lh /${buildVolumeFolder}
          #
      `,
      ],
      `/${buildVolumeFolder}`,
      `/${buildVolumeFolder}/`,
      [
        {
          name: 'GITHUB_SHA',
          value: process.env.GITHUB_SHA || '',
        },
      ],
      defaultSecretsArray,
    );
  }

  private static async BuildStep(
    buildUid: string,
    buildParameters: BuildParameters,
    baseImage: any,
    defaultSecretsArray: RemoteBuilderSecret[],
  ) {
    const buildSecrets = new Array();

    buildSecrets.push(...defaultSecretsArray);

    if (process.env.UNITY_LICENSE)
      buildSecrets.push({
        ParameterKey: 'UnityLicense',
        EnvironmentVariable: 'UNITY_LICENSE',
        ParameterValue: process.env.UNITY_LICENSE,
      });

    if (process.env.UNITY_EMAIL)
      buildSecrets.push({
        ParameterKey: 'UnityEmail',
        EnvironmentVariable: 'UNITY_EMAIL',
        ParameterValue: process.env.UNITY_EMAIL,
      });

    if (process.env.UNITY_PASSWORD)
      buildSecrets.push({
        ParameterKey: 'UnityPassword',
        EnvironmentVariable: 'UNITY_PASSWORD',
        ParameterValue: process.env.UNITY_PASSWORD,
      });

    if (process.env.UNITY_SERIAL)
      buildSecrets.push({
        ParameterKey: 'UnitySerial',
        EnvironmentVariable: 'UNITY_SERIAL',
        ParameterValue: process.env.UNITY_SERIAL,
      });

    if (buildParameters.androidKeystoreBase64)
      buildSecrets.push({
        ParameterKey: 'AndroidKeystoreBase64',
        EnvironmentVariable: 'ANDROID_KEYSTORE_BASE64',
        ParameterValue: buildParameters.androidKeystoreBase64,
      });

    if (buildParameters.androidKeystorePass)
      buildSecrets.push({
        ParameterKey: 'AndroidKeystorePass',
        EnvironmentVariable: 'ANDROID_KEYSTORE_PASS',
        ParameterValue: buildParameters.androidKeystorePass,
      });

    if (buildParameters.androidKeyaliasPass)
      buildSecrets.push({
        ParameterKey: 'AndroidKeyAliasPass',
        EnvironmentVariable: 'AWS_ACCESS_KEY_ALIAS_PASS',
        ParameterValue: buildParameters.androidKeyaliasPass,
      });
    core.info('Starting part 2/4 (build unity project)');
    await this.RemoteBuilderProviderPlatform.runBuildTask(
      buildUid,
      baseImage.toString(),
      [
        `
            cp -r /${buildVolumeFolder}/${buildUid}/builder/dist/default-build-script/ /UnityBuilderAction;
            cp -r /${buildVolumeFolder}/${buildUid}/builder/dist/entrypoint.sh /entrypoint.sh;
            cp -r /${buildVolumeFolder}/${buildUid}/builder/dist/steps/ /steps;
            chmod -R +x /entrypoint.sh;
            chmod -R +x /steps;
            /entrypoint.sh;
          `,
      ],
      `/${buildVolumeFolder}`,
      `/${buildVolumeFolder}/${buildUid}/${repositoryFolder}/`,
      [
        {
          name: 'ContainerMemory',
          value: buildParameters.remoteBuildMemory,
        },
        {
          name: 'ContainerCpu',
          value: buildParameters.remoteBuildCpu,
        },
        {
          name: 'GITHUB_WORKSPACE',
          value: `/${buildVolumeFolder}/${buildUid}/${repositoryFolder}/`,
        },
        {
          name: 'PROJECT_PATH',
          value: buildParameters.projectPath,
        },
        {
          name: 'BUILD_PATH',
          value: buildParameters.buildPath,
        },
        {
          name: 'BUILD_FILE',
          value: buildParameters.buildFile,
        },
        {
          name: 'BUILD_NAME',
          value: buildParameters.buildName,
        },
        {
          name: 'BUILD_METHOD',
          value: buildParameters.buildMethod,
        },
        {
          name: 'CUSTOM_PARAMETERS',
          value: buildParameters.customParameters,
        },
        {
          name: 'BUILD_TARGET',
          value: buildParameters.platform,
        },
        {
          name: 'ANDROID_VERSION_CODE',
          value: buildParameters.androidVersionCode.toString(),
        },
        {
          name: 'ANDROID_KEYSTORE_NAME',
          value: buildParameters.androidKeystoreName,
        },
        {
          name: 'ANDROID_KEYALIAS_NAME',
          value: buildParameters.androidKeyaliasName,
        },
      ],
      buildSecrets,
    );
  }

  private static async CompressionStep(
    buildUid: string,
    buildParameters: BuildParameters,
    branchName: string | undefined,
    defaultSecretsArray: RemoteBuilderSecret[],
  ) {
    core.info('Starting step 3/4 build compression');
    // Cleanup
    await this.RemoteBuilderProviderPlatform.runBuildTask(
      buildUid,
      'alpine',
      [
        `
            apk update
            apk add zip
            cd Library
            zip -r lib-${buildUid}.zip .*
            mv lib-${buildUid}.zip /${buildVolumeFolder}/${cacheFolder}/${branchName}/lib-${buildUid}.zip
            cd ../../
            ls
            echo ' '
            ls ${buildParameters.buildPath}
            zip -r build-${buildUid}.zip ${buildParameters.buildPath}/*
            mv build-${buildUid}.zip /${buildVolumeFolder}/${buildUid}/build-${buildUid}.zip
          `,
      ],
      `/${buildVolumeFolder}`,
      `/${buildVolumeFolder}/${buildUid}/${repositoryFolder}/${buildParameters.projectPath}`,
      [
        {
          name: 'GITHUB_SHA',
          value: process.env.GITHUB_SHA || '',
        },
      ],
      defaultSecretsArray,
    );
    core.info('compression step complete');
  }

  private static async UploadArtifacts(
    buildUid: string,
    buildParameters: BuildParameters,
    branchName: string | undefined,
    defaultSecretsArray: RemoteBuilderSecret[],
  ) {
    core.info('Starting step 4/4 upload build to s3');
    await this.RemoteBuilderProviderPlatform.runBuildTask(
      buildUid,
      'amazon/aws-cli',
      [
        `
            aws s3 cp ${buildUid}/build-${buildUid}.zip s3://game-ci-storage/
            # no need to upload Library cache for now
            # aws s3 cp /${buildVolumeFolder}/${cacheFolder}/${branchName}/lib-${buildUid}.zip s3://game-ci-storage/
            ${this.SteamDeploy ? '#' : ''} rm -r ${buildUid}
          `,
      ],
      `/${buildVolumeFolder}`,
      `/${buildVolumeFolder}/`,
      [
        {
          name: 'GITHUB_SHA',
          value: process.env.GITHUB_SHA || '',
        },
        {
          name: 'AWS_DEFAULT_REGION',
          value: process.env.AWS_DEFAULT_REGION || '',
        },
      ],
      [
        {
          ParameterKey: 'AWSAccessKeyID',
          EnvironmentVariable: 'AWS_ACCESS_KEY_ID',
          ParameterValue: process.env.AWS_ACCESS_KEY_ID || '',
        },
        {
          ParameterKey: 'AWSSecretAccessKey',
          EnvironmentVariable: 'AWS_SECRET_ACCESS_KEY',
          ParameterValue: process.env.AWS_SECRET_ACCESS_KEY || '',
        },
        ...defaultSecretsArray,
      ],
    );
  }

  private static async DeployToSteam(
    buildUid: string,
    buildParameters: BuildParameters,
    defaultSecretsArray: RemoteBuilderSecret[],
  ) {
    core.info('Starting steam deployment');
    await this.RemoteBuilderProviderPlatform.runBuildTask(
      buildUid,
      'cm2network/steamcmd:root',
      [
        `
            ls
            ls /
            cp -r /${buildVolumeFolder}/${buildUid}/steam/action/entrypoint.sh /entrypoint.sh;
            cp -r /${buildVolumeFolder}/${buildUid}/steam/action/steps/ /steps;
            chmod -R +x /entrypoint.sh;
            chmod -R +x /steps;
            /entrypoint.sh;
            rm -r /${buildVolumeFolder}/${buildUid}
          `,
      ],
      `/${buildVolumeFolder}`,
      `/${buildVolumeFolder}/${buildUid}/steam/action/`,
      [
        {
          name: 'GITHUB_SHA',
          value: process.env.GITHUB_SHA || '',
        },
      ],
      [
        {
          EnvironmentVariable: 'INPUT_APPID',
          ParameterKey: 'appId',
          ParameterValue: process.env.APP_ID || '',
        },
        {
          EnvironmentVariable: 'INPUT_BUILDDESCRIPTION',
          ParameterKey: 'buildDescription',
          ParameterValue: process.env.BUILD_DESCRIPTION || '',
        },
        {
          EnvironmentVariable: 'INPUT_ROOTPATH',
          ParameterKey: 'rootPath',
          ParameterValue: buildParameters.buildPath,
        },
        {
          EnvironmentVariable: 'INPUT_RELEASEBRANCH',
          ParameterKey: 'releaseBranch',
          ParameterValue: process.env.RELEASE_BRANCH || '',
        },
        {
          EnvironmentVariable: 'INPUT_LOCALCONTENTSERVER',
          ParameterKey: 'localContentServer',
          ParameterValue: process.env.LOCAL_CONTENT_SERVER || '',
        },
        {
          EnvironmentVariable: 'INPUT_PREVIEWENABLED',
          ParameterKey: 'previewEnabled',
          ParameterValue: process.env.PREVIEW_ENABLED || '',
        },
        ...defaultSecretsArray,
      ],
    );
  }
}
export default RemoteBuilder;
