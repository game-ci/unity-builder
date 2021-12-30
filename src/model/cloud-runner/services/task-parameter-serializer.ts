import { Input } from '../..';
import ImageEnvironmentFactory from '../../image-environment-factory';
import CloudRunnerEnvironmentVariable from './cloud-runner-environment-variable';
import { CloudRunnerState } from '../state/cloud-runner-state';

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
        name: 'BUILD_TARGET',
        value: CloudRunnerState.buildParams.platform,
      },
      ...TaskParameterSerializer.serializeBuildParamsAndInput,
    ];
  }
  private static get serializeBuildParamsAndInput() {
    let array = new Array();
    array = TaskParameterSerializer.readBuildParameters(array);
    array = TaskParameterSerializer.readInput(array);
    array = array.filter((x) => x.value !== undefined && x.name !== '0');
    return array;
  }

  private static readBuildParameters(array: any[]) {
    const keys = Object.keys(CloudRunnerState.buildParams);
    for (const element of keys) {
      array.push(
        //{
        //  name: element,
        //  value: `${CloudRunnerState.buildParams[element]}`,
        //},
        {
          name: element
            .replace(/([A-Z])/g, ' $1')
            .trim()
            .toUpperCase()
            .replace(/ /g, '_'),
          value: `${CloudRunnerState.buildParams[element]}`,
        },
      );
    }
    array.push(
      { name: 'buildParameters', value: JSON.stringify(CloudRunnerState.buildParams) },
      {
        name: Object.keys(CloudRunnerState.buildGuid)[0],
        value: CloudRunnerState.buildGuid,
      },
    );
    return array;
  }

  private static readInput(array: any[]) {
    const input = Object.getOwnPropertyNames(Input);
    for (const element of input) {
      if (typeof Input[element] !== 'function') {
        array.push(
          //{
          //  name: element,
          //  value: `${Input[element]}`,
          //},
          {
            name: element
              .replace(/([A-Z])/g, ' $1')
              .trim()
              .toUpperCase()
              .replace(/ /g, '_'),
            value: `${Input[element]}`,
          },
        );
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
