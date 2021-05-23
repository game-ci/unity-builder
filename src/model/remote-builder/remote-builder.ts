import { customAlphabet } from 'nanoid';
import AWSBuildPlatform from './aws-build-platform';
import * as core from '@actions/core';
import RemoteBuilderConstants from './remote-builder-constants';
import { BuildParameters } from '..';
const repositoryDirectoryName = 'repo';
const efsDirectoryName = 'data';
const cacheDirectoryName = 'cache';

class RemoteBuilder {
  static SteamDeploy: boolean = false;
  static async build(buildParameters: BuildParameters, baseImage) {
    try {
      this.SteamDeploy = process.env.STEAM_DEPLOY !== undefined || false;
      const nanoid = customAlphabet(RemoteBuilderConstants.alphabet, 4);
      const buildUid = `${process.env.GITHUB_RUN_NUMBER}-${buildParameters.platform
        .replace('Standalone', '')
        .replace('standalone', '')}-${nanoid()}`;
      const defaultBranchName =
        process.env.GITHUB_REF?.split('/')
          .filter((x) => {
            x = x[0].toUpperCase() + x.slice(1);
            return x;
          })
          .join('') || '';
      const branchName =
        process.env.REMOTE_BUILDER_CACHE !== undefined ? process.env.REMOTE_BUILDER_CACHE : defaultBranchName;
      const token: string = buildParameters.githubToken;
      const defaultSecretsArray = [
        {
          ParameterKey: 'GithubToken',
          EnvironmentVariable: 'GITHUB_TOKEN',
          ParameterValue: token,
        },
      ];
      await RemoteBuilder.SetupStep(buildUid, buildParameters, branchName, defaultSecretsArray);
      await RemoteBuilder.BuildStep(buildUid, buildParameters, baseImage, defaultSecretsArray);
      await RemoteBuilder.CompressionStep(buildUid, buildParameters, branchName, defaultSecretsArray);
      await RemoteBuilder.UploadArtifacts(buildUid, buildParameters, branchName, defaultSecretsArray);
      if (this.SteamDeploy) {
        await RemoteBuilder.DeployToSteam(buildUid, buildParameters, defaultSecretsArray);
      }
    } catch (error) {
      core.setFailed(error);
      core.error(error);
    }
  }

  private static async SetupStep(
    buildUid: string,
    buildParameters: BuildParameters,
    branchName: string | undefined,
    defaultSecretsArray: { ParameterKey: string; EnvironmentVariable: string; ParameterValue: string }[],
  ) {
    core.info('Starting step 1/4 clone and restore cache)');
    await AWSBuildPlatform.runBuild(
      buildUid,
      buildParameters.awsStackName,
      'alpine/git',
      [
        '-c',
        `apk update;
          apk add unzip;
          apk add git-lfs;
          apk add jq;
          # Get source repo for project to be built and game-ci repo for utilties
          git clone https://${buildParameters.githubToken}@github.com/${
          process.env.GITHUB_REPOSITORY
        }.git ${buildUid}/${repositoryDirectoryName} -q
          git clone https://${buildParameters.githubToken}@github.com/game-ci/unity-builder.git ${buildUid}/builder -q
          git clone https://${buildParameters.githubToken}@github.com/game-ci/steam-deploy.git ${buildUid}/steam -q
          cd /${efsDirectoryName}/${buildUid}/${repositoryDirectoryName}/
          git checkout $GITHUB_SHA
          cd /${efsDirectoryName}/
          # Look for usable cache
          if [ ! -d ${cacheDirectoryName} ]; then
            mkdir ${cacheDirectoryName}
          fi
          cd ${cacheDirectoryName}
          if [ ! -d "${branchName}" ]; then
            mkdir "${branchName}"
          fi
          cd "${branchName}"
          echo ''
          echo "Cached Libraries for ${branchName} from previous builds:"
          ls
          echo ''
          ls "/${efsDirectoryName}/${buildUid}/${repositoryDirectoryName}/${buildParameters.projectPath}"
          libDir="/${efsDirectoryName}/${buildUid}/${repositoryDirectoryName}/${buildParameters.projectPath}/Library"
          if [ -d "$libDir" ]; then
            rm -r "$libDir"
            echo "Setup .gitignore to ignore Library folder and remove it from builds"
          fi
          echo 'Checking cache'
          # Restore cache
          latest=$(ls -t | head -1)
          if [ ! -z "$latest" ]; then
            echo "Library cache exists from build $latest from ${branchName}"
            echo 'Creating empty Library folder for cache'
            mkdir $libDir
            unzip -q $latest -d $libDir
            # purge cache
            ${process.env.PURGE_REMOTE_BUILDER_CACHE === undefined ? '#' : ''} rm -r $libDir
          else
            echo 'Cache does not exist'
          fi
          # Print out important directories
          echo ''
          echo 'Repo:'
          ls /${efsDirectoryName}/${buildUid}/${repositoryDirectoryName}/
          echo ''
          echo 'Project:'
          ls /${efsDirectoryName}/${buildUid}/${repositoryDirectoryName}/${buildParameters.projectPath}
          echo ''
          echo 'Library:'
          ls /${efsDirectoryName}/${buildUid}/${repositoryDirectoryName}/${buildParameters.projectPath}/Library/
          echo ''
      `,
      ],
      `/${efsDirectoryName}`,
      `/${efsDirectoryName}/`,
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
    defaultSecretsArray: any[],
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
    await AWSBuildPlatform.runBuild(
      buildUid,
      buildParameters.awsStackName,
      baseImage.toString(),
      [
        '-c',
        `
            cp -r /${efsDirectoryName}/${buildUid}/builder/dist/default-build-script/ /UnityBuilderAction;
            cp -r /${efsDirectoryName}/${buildUid}/builder/dist/entrypoint.sh /entrypoint.sh;
            cp -r /${efsDirectoryName}/${buildUid}/builder/dist/steps/ /steps;
            chmod -R +x /entrypoint.sh;
            chmod -R +x /steps;
            /entrypoint.sh;
          `,
      ],
      `/${efsDirectoryName}`,
      `/${efsDirectoryName}/${buildUid}/${repositoryDirectoryName}/`,
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
          value: `/${efsDirectoryName}/${buildUid}/${repositoryDirectoryName}/`,
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
    defaultSecretsArray: { ParameterKey: string; EnvironmentVariable: string; ParameterValue: string }[],
  ) {
    core.info('Starting step 3/4 build compression');
    // Cleanup
    await AWSBuildPlatform.runBuild(
      buildUid,
      buildParameters.awsStackName,
      'alpine',
      [
        '-c',
        `
            apk update
            apk add zip
            cd Library
            zip -r lib-${buildUid}.zip .*
            mv lib-${buildUid}.zip /${efsDirectoryName}/${cacheDirectoryName}/${branchName}/lib-${buildUid}.zip
            cd ../../
            zip -r build-${buildUid}.zip ${buildParameters.buildPath}/*
            mv build-${buildUid}.zip /${efsDirectoryName}/${buildUid}/build-${buildUid}.zip
          `,
      ],
      `/${efsDirectoryName}`,
      `/${efsDirectoryName}/${buildUid}/${repositoryDirectoryName}/${buildParameters.projectPath}`,
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
    defaultSecretsArray: { ParameterKey: string; EnvironmentVariable: string; ParameterValue: string }[],
  ) {
    core.info('Starting step 4/4 upload build to s3');
    await AWSBuildPlatform.runBuild(
      buildUid,
      buildParameters.awsStackName,
      'amazon/aws-cli',
      [
        '-c',
        `
            aws s3 cp ${buildUid}/build-${buildUid}.zip s3://game-ci-storage/
            # no need to upload Library cache for now
            # aws s3 cp /${efsDirectoryName}/${cacheDirectoryName}/${branchName}/lib-${buildUid}.zip s3://game-ci-storage/
            ${this.SteamDeploy ? '#' : ''} rm -r ${buildUid}
          `,
      ],
      `/${efsDirectoryName}`,
      `/${efsDirectoryName}/`,
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
    defaultSecretsArray: { ParameterKey: string; EnvironmentVariable: string; ParameterValue: string }[],
  ) {
    core.info('Starting steam deployment');
    await AWSBuildPlatform.runBuild(
      buildUid,
      buildParameters.awsStackName,
      'cm2network/steamcmd:root',
      [
        '-c',
        `
            ls
            ls /
            cp -r /${efsDirectoryName}/${buildUid}/steam/action/entrypoint.sh /entrypoint.sh;
            cp -r /${efsDirectoryName}/${buildUid}/steam/action/steps/ /steps;
            chmod -R +x /entrypoint.sh;
            chmod -R +x /steps;
            /entrypoint.sh;
            rm -r /${efsDirectoryName}/${buildUid}
          `,
      ],
      `/${efsDirectoryName}`,
      `/${efsDirectoryName}/${buildUid}/steam/action/`,
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
          ParameterValue: process.env.ROOT_PATH || '',
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
