import { Input } from '../..';
import CloudRunnerEnvironmentVariable from './cloud-runner-environment-variable';
import { CloudRunnerCustomHooks } from './cloud-runner-custom-hooks';
import CloudRunnerSecret from './cloud-runner-secret';
import CloudRunnerQueryOverride from './cloud-runner-query-override';
import CloudRunnerOptionsReader from './cloud-runner-options-reader';
import BuildParameters from '../../build-parameters';
import CloudRunnerOptions from '../cloud-runner-options';
import * as core from '@actions/core';

export class TaskParameterSerializer {
  static readonly blocked = new Set(['0', 'length', 'prototype', '', 'unityVersion']);
  public static createCloudRunnerEnvironmentVariables(
    buildParameters: BuildParameters,
  ): CloudRunnerEnvironmentVariable[] {
    const result = this.uniqBy(
      [
        {
          name: 'ContainerMemory',
          value: buildParameters.cloudRunnerMemory,
        },
        {
          name: 'ContainerCpu',
          value: buildParameters.cloudRunnerCpu,
        },
        {
          name: 'BUILD_TARGET',
          value: buildParameters.targetPlatform,
        },
        ...TaskParameterSerializer.serializeFromObject(buildParameters),
        ...TaskParameterSerializer.readInput(),
        ...CloudRunnerCustomHooks.getSecrets(CloudRunnerCustomHooks.getHooks(buildParameters.customJobHooks)),
      ]
        .filter(
          (x) =>
            !TaskParameterSerializer.blocked.has(x.name) &&
            x.value !== '' &&
            x.value !== undefined &&
            x.name !== `CUSTOM_JOB` &&
            x.name !== `GAMECI_CUSTOM_JOB` &&
            x.value !== `undefined`,
        )
        .map((x) => {
          x.name = TaskParameterSerializer.ToEnvVarFormat(x.name);
          x.value = `${x.value}`;

          if (buildParameters.cloudRunnerDebug && Number(x.name) === Number.NaN) {
            core.info(`[ERROR] found a number in task param serializer ${JSON.stringify(x)}`);
          }

          return x;
        }),
      (item) => item.name,
    );

    return result;
  }

  static uniqBy(a, key) {
    const seen = {};

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
          .filter((x) => !this.blocked.has(x) && x.startsWith('GAMECI_'))
          .map((x) => TaskParameterSerializer.UndoEnvVarFormat(x)),
      ),
    ];

    for (const element of keys) {
      if (element !== `customJob`) {
        buildParameters[element] = process.env[`GAMECI_${TaskParameterSerializer.ToEnvVarFormat(element)}`];
      }
    }

    return buildParameters;
  }

  private static readInput() {
    return TaskParameterSerializer.serializeFromType(Input);
  }

  public static ToEnvVarFormat(input): string {
    return CloudRunnerOptions.ToEnvVarFormat(input);
  }

  public static UndoEnvVarFormat(element): string {
    return this.camelize(element.replace('GAMECI_', '').toLowerCase().replace(/_+/g, ' '));
  }

  private static camelize(string) {
    return string
      .replace(/^\w|[A-Z]|\b\w/g, function (word, index) {
        return index === 0 ? word.toLowerCase() : word.toUpperCase();
      })
      .replace(/\s+/g, '');
  }

  private static serializeFromObject(buildParameters) {
    const array: any[] = [];
    const keys = Object.getOwnPropertyNames(buildParameters).filter((x) => !this.blocked.has(x));
    for (const element of keys) {
      array.push(
        {
          name: `GAMECI_${TaskParameterSerializer.ToEnvVarFormat(element)}`,
          value: buildParameters[element],
        },
        {
          name: element,
          value: buildParameters[element],
        },
      );
    }

    return array;
  }

  private static serializeFromType(type) {
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
    array = TaskParameterSerializer.tryAddInput(array, 'UNITY_LICENSE');
    array = TaskParameterSerializer.tryAddInput(array, 'GIT_PRIVATE_TOKEN');

    return array;
  }
  private static getValue(key) {
    return CloudRunnerQueryOverride.queryOverrides !== undefined &&
      CloudRunnerQueryOverride.queryOverrides[key] !== undefined
      ? CloudRunnerQueryOverride.queryOverrides[key]
      : process.env[key];
  }
  s;
  private static tryAddInput(array, key): CloudRunnerSecret[] {
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
