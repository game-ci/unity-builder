import { customAlphabet } from 'nanoid';
import AWSBuildPlatform from './aws-build-platform';
import * as core from '@actions/core';
import RemoteBuilderAlphabet from './remote-builder-alphabet';
import { BuildParameters } from '..';
const repositoryDirectoryName = 'repo';
const efsDirectoryName = 'data';
const cacheDirectoryName = 'cache';

class RemoteBuilder {
  static async runBuildJob(buildParameters: BuildParameters, baseImage) {
    try {
      const nanoid = customAlphabet(RemoteBuilderAlphabet.alphabet, 4);
      const buildUid = `${process.env.GITHUB_RUN_NUMBER}-${buildParameters.platform
        .replace('Standalone', '')
        .replace('standalone', '')}-${nanoid()}`;
      const branchName = process.env.GITHUB_REF?.split('/').reverse()[0];
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
      await RemoteBuilder.DeployToSteam(buildUid, buildParameters);
    } catch (error) {
      core.setFailed(error);
      core.error(error);
    }
  }

  private static async DeployToSteam(buildUid: string, buildParameters: BuildParameters) {
    core.info('Starting steam deployment');
    await AWSBuildPlatform.runBuild(
      buildUid,
      buildParameters.awsStackName,
      'cm2network/steamcmd:root',
      [
        '-c',
        `
            ls
            chmod -R +x /entrypoint.sh;
            chmod -R +x /steps;
            /entrypoint.sh;
          `,
      ],
      `/${efsDirectoryName}`,
      `/${efsDirectoryName}/${buildUid}/steam/action/`,
      [],
      [],
    );
  }

  private static async UploadArtifacts(
    buildUid: string,
    buildParameters: BuildParameters,
    branchName: string | undefined,
    defaultSecretsArray: { ParameterKey: string; EnvironmentVariable: string; ParameterValue: string }[],
  ) {
    core.info('Starting part 4/4 (upload build to s3)');
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
            rm -r ${buildUid}
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

  private static async CompressionStep(
    buildUid: string,
    buildParameters: BuildParameters,
    branchName: string | undefined,
    defaultSecretsArray: { ParameterKey: string; EnvironmentVariable: string; ParameterValue: string }[],
  ) {
    core.info('Starting part 3/4 (zip unity build and Library for caching)');
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
            zip -q -r lib-${buildUid}.zip .*
            mv lib-${buildUid}.zip /${efsDirectoryName}/${cacheDirectoryName}/${branchName}/lib-${buildUid}.zip
            cd ../../
            zip -q -r build-${buildUid}.zip ${buildParameters.buildPath}/*
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

  private static async SetupStep(
    buildUid: string,
    buildParameters: BuildParameters,
    branchName: string | undefined,
    defaultSecretsArray: { ParameterKey: string; EnvironmentVariable: string; ParameterValue: string }[],
  ) {
    core.info('Starting part 1/4 (clone from github and restore cache)');
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
          git clone https://${buildParameters.githubToken}@github.com/${process.env.GITHUB_REPOSITORY}.git ${buildUid}/${repositoryDirectoryName} -q
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
          echo " "
          echo "Cached Libraries for ${branchName} from previous builds:"
          ls
          echo " "
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
            mkdir "$libDir"
            unzip -q $latest -d '/${efsDirectoryName}/${buildUid}/${repositoryDirectoryName}/${buildParameters.projectPath}/Library/.'
          else
            echo 'Cache does not exist'
          fi
          # Print out important directories
          echo ' '
          echo 'Repo:'
          ls /${efsDirectoryName}/${buildUid}/${repositoryDirectoryName}/
          echo ' '
          echo 'Project:'
          ls /${efsDirectoryName}/${buildUid}/${repositoryDirectoryName}/${buildParameters.projectPath}
          echo ' '
          echo 'Library:'
          ls /${efsDirectoryName}/${buildUid}/${repositoryDirectoryName}/${buildParameters.projectPath}/Library/
          echo ' '
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
}
export default RemoteBuilder;
