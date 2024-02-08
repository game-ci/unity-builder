import BuildParameters from '../../../build-parameters';
import Input from '../../../input';
import CloudRunnerOptions from '../../options/cloud-runner-options';
import CloudRunnerEnvironmentVariable from '../../options/cloud-runner-environment-variable';
import CloudRunnerOptionsReader from '../../options/cloud-runner-options-reader';
import CloudRunnerQueryOverride from '../../options/cloud-runner-query-override';
import CloudRunnerSecret from '../../options/cloud-runner-secret';
import { CommandHookService } from '../hooks/command-hook-service';

export class TaskParameterSerializer {
  static readonly blockedParameterNames: Set<string> = new Set([
    '0',
    'length',
    'prototype',
    '',
    'unityVersion',
    'CACHE_UNITY_INSTALLATION_ON_MAC',
    'RUNNER_TEMP_PATH',
    'NAME',
    'CUSTOM_JOB',
  ]);
  public static createCloudRunnerEnvironmentVariables(
    buildParameters: BuildParameters,
  ): CloudRunnerEnvironmentVariable[] {
    const result: CloudRunnerEnvironmentVariable[] = this.uniqBy(
      [
        ...[
          { name: 'BUILD_TARGET', value: buildParameters.targetPlatform },
          { name: 'UNITY_VERSION', value: buildParameters.editorVersion },
          { name: 'GITHUB_TOKEN', value: process.env.GITHUB_TOKEN },
        ],
        ...TaskParameterSerializer.serializeFromObject(buildParameters),
        ...TaskParameterSerializer.serializeInput(),
        ...TaskParameterSerializer.serializeCloudRunnerOptions(),
        ...CommandHookService.getSecrets(CommandHookService.getHooks(buildParameters.commandHooks)),
      ]
        .filter(
          (x) =>
            !TaskParameterSerializer.blockedParameterNames.has(x.name) &&
            x.value !== '' &&
            x.value !== undefined &&
            x.value !== `undefined`,
        )
        .map((x) => {
          x.name = `${TaskParameterSerializer.ToEnvVarFormat(x.name)}`;
          x.value = `${x.value}`;

          return x;
        }),
      (item: CloudRunnerEnvironmentVariable) => item.name,
    );

    return result;
  }

  // eslint-disable-next-line no-unused-vars
  static uniqBy(a: CloudRunnerEnvironmentVariable[], key: (parameters: CloudRunnerEnvironmentVariable) => string) {
    const seen: { [key: string]: boolean } = {};

    return a.filter(function (item) {
      const k = key(item);

      return seen.hasOwnProperty(k) ? false : (seen[k] = true);
    });
  }

  public static readBuildParameterFromEnvironment(): BuildParameters {
    const buildParameters = new BuildParameters();
    const keys = [
      ...new Set(
        Object.getOwnPropertyNames(process.env)
          .filter((x) => !this.blockedParameterNames.has(x) && x.startsWith(''))
          .map((x) => TaskParameterSerializer.UndoEnvVarFormat(x)),
      ),
    ];

    for (const element of keys) {
      if (element !== `customJob`) {
        buildParameters[element] = process.env[`${TaskParameterSerializer.ToEnvVarFormat(element)}`];
      }
    }

    return buildParameters;
  }

  private static serializeInput() {
    return TaskParameterSerializer.serializeFromType(Input);
  }

  private static serializeCloudRunnerOptions() {
    return TaskParameterSerializer.serializeFromType(CloudRunnerOptions);
  }

  public static ToEnvVarFormat(input: string): string {
    return CloudRunnerOptions.ToEnvVarFormat(input);
  }

  public static UndoEnvVarFormat(element: string): string {
    return this.camelize(element.toLowerCase().replace(/_+/g, ' '));
  }

  private static camelize(string: string) {
    return TaskParameterSerializer.uncapitalizeFirstLetter(
      string
        .replace(/(^\w)|([A-Z])|(\b\w)/g, function (word: string, index: number) {
          return index === 0 ? word.toLowerCase() : word.toUpperCase();
        })
        .replace(/\s+/g, ''),
    );
  }

  private static uncapitalizeFirstLetter(string: string) {
    return string.charAt(0).toLowerCase() + string.slice(1);
  }

  private static serializeFromObject(buildParameters: any) {
    const array: any[] = [];
    const keys = Object.getOwnPropertyNames(buildParameters).filter((x) => !this.blockedParameterNames.has(x));
    for (const element of keys) {
      array.push({
        name: TaskParameterSerializer.ToEnvVarFormat(element),
        value: buildParameters[element],
      });
    }

    return array;
  }

  private static serializeFromType(type: any) {
    const array: any[] = [];
    const input = CloudRunnerOptionsReader.GetProperties();
    for (const element of input) {
      if (typeof type[element] !== 'function' && array.filter((x) => x.name === element).length === 0) {
        array.push({
          name: element,
          value: `${type[element]}`,
        });
      }
    }

    return array;
  }

  public static readDefaultSecrets(): CloudRunnerSecret[] {
    let array = new Array();
    array = TaskParameterSerializer.tryAddInput(array, 'UNITY_SERIAL');
    array = TaskParameterSerializer.tryAddInput(array, 'UNITY_EMAIL');
    array = TaskParameterSerializer.tryAddInput(array, 'UNITY_PASSWORD');

    // array = TaskParameterSerializer.tryAddInput(array, 'UNITY_LICENSE');
    array = TaskParameterSerializer.tryAddInput(array, 'GIT_PRIVATE_TOKEN');

    return array;
  }

  private static getValue(key: string) {
    return CloudRunnerQueryOverride.queryOverrides !== undefined &&
      CloudRunnerQueryOverride.queryOverrides[key] !== undefined
      ? CloudRunnerQueryOverride.queryOverrides[key]
      : process.env[key];
  }

  private static tryAddInput(array: CloudRunnerSecret[], key: string): CloudRunnerSecret[] {
    const value = TaskParameterSerializer.getValue(key);
    if (value !== undefined && value !== '' && value !== 'null') {
      array.push({
        ParameterKey: key,
        EnvironmentVariable: key,
        ParameterValue: value,
      });
    }

    return array;
  }
}
