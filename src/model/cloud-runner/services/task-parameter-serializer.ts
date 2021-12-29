import { Input } from '../..';
import ImageEnvironmentFactory from '../../image-environment-factory';
import CloudRunnerEnvironmentVariable from './cloud-runner-environment-variable';
import { CloudRunnerState } from '../state/cloud-runner-state';
import CloudRunnerLogger from './cloud-runner-logger';

export class TaskParameterSerializer {
  public static readBuildEnvironmentVariables(): CloudRunnerEnvironmentVariable[] {
    return [
      {
        name: 'ContainerMemory',
        value: CloudRunnerState.buildParams.cloudRunnerMemory,
      },
      {
        name: 'ContainerCpu',
        value: CloudRunnerState.buildParams.cloudRunnerCpu,
      },
      {
        name: 'GITHUB_WORKSPACE',
        value: `/${CloudRunnerState.buildVolumeFolder}/${CloudRunnerState.buildGuid}/${CloudRunnerState.repositoryFolder}/`,
      },
      {
        name: 'PROJECT_PATH',
        value: CloudRunnerState.buildParams.projectPath,
      },
      {
        name: 'BUILD_PATH',
        value: CloudRunnerState.buildParams.buildPath,
      },
      {
        name: 'BUILD_FILE',
        value: CloudRunnerState.buildParams.buildFile,
      },
      {
        name: 'BUILD_NAME',
        value: CloudRunnerState.buildParams.buildName,
      },
      {
        name: 'BUILD_METHOD',
        value: CloudRunnerState.buildParams.buildMethod,
      },
      {
        name: 'CUSTOM_PARAMETERS',
        value: CloudRunnerState.buildParams.customParameters,
      },
      {
        name: 'BUILD_TARGET',
        value: CloudRunnerState.buildParams.platform,
      },
      {
        name: 'ANDROID_VERSION_CODE',
        value: CloudRunnerState.buildParams.androidVersionCode.toString(),
      },
      {
        name: 'ANDROID_KEYSTORE_NAME',
        value: CloudRunnerState.buildParams.androidKeystoreName,
      },
      {
        name: 'ANDROID_KEYALIAS_NAME',
        value: CloudRunnerState.buildParams.androidKeyaliasName,
      },
      ...TaskParameterSerializer.serializeBuildParamsAndInput,
    ];
  }
  private static get serializeBuildParamsAndInput() {
    let array = new Array();
    array = TaskParameterSerializer.readBuildParameters(array);
    array = TaskParameterSerializer.readInput(array);
    return array;
  }

  private static readBuildParameters(array: any[]) {
    const keys = Object.keys(CloudRunnerState.buildParams);
    for (const element of keys) {
      array.push({
        name: element,
        value: `${CloudRunnerState.buildParams[element]}`,
      });
    }
    array.push({ name: 'buildParameters', value: JSON.stringify(CloudRunnerState.buildParams) });
    return array;
  }

  private static readInput(array: any[]) {
    const input = Object.getOwnPropertyNames(Input);
    for (const element of input) {
      CloudRunnerLogger.log(
        JSON.stringify(
          {
            type: `${typeof Input[element]}`,
            name: Input[element],
          },
          undefined,
          4,
        ),
      );
      if (typeof Input[element] !== 'function') {
        array.push({
          name: element,
          value: `${Input[element]}`,
        });
      }
    }
    return array;
  }

  public static setupDefaultSecrets() {
    CloudRunnerState.defaultSecrets = [
      {
        ParameterKey: 'GithubToken',
        EnvironmentVariable: 'GITHUB_TOKEN',
        ParameterValue: CloudRunnerState.buildParams.githubToken,
      },
      {
        ParameterKey: 'branch',
        EnvironmentVariable: 'branch',
        ParameterValue: CloudRunnerState.branchName,
      },
      {
        ParameterKey: 'buildPathFull',
        EnvironmentVariable: 'buildPathFull',
        ParameterValue: CloudRunnerState.buildPathFull,
      },
      {
        ParameterKey: 'projectPathFull',
        EnvironmentVariable: 'projectPathFull',
        ParameterValue: CloudRunnerState.projectPathFull,
      },
      {
        ParameterKey: 'libraryFolderFull',
        EnvironmentVariable: 'libraryFolderFull',
        ParameterValue: CloudRunnerState.libraryFolderFull,
      },
      {
        ParameterKey: 'builderPathFull',
        EnvironmentVariable: 'builderPathFull',
        ParameterValue: CloudRunnerState.builderPathFull,
      },
      {
        ParameterKey: 'repoPathFull',
        EnvironmentVariable: 'repoPathFull',
        ParameterValue: CloudRunnerState.repoPathFull,
      },
      {
        ParameterKey: 'steamPathFull',
        EnvironmentVariable: 'steamPathFull',
        ParameterValue: CloudRunnerState.steamPathFull,
      },
    ];
    CloudRunnerState.defaultSecrets.push(
      ...ImageEnvironmentFactory.getEnvironmentVariables(CloudRunnerState.buildParams).map((x) => {
        return {
          ParameterKey: x.name,
          EnvironmentVariable: x.name,
          ParameterValue: x.value,
        };
      }),
    );
  }
}
