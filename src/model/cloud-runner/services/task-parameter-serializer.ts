import { Input } from '../..';
import CloudRunnerEnvironmentVariable from './cloud-runner-environment-variable';
import { CloudRunnerCustomHooks } from './cloud-runner-custom-hooks';
import CloudRunnerSecret from './cloud-runner-secret';
import CloudRunnerQueryOverride from './cloud-runner-query-override';
import CloudRunnerOptionsReader from './cloud-runner-options-reader';
import BuildParameters from '../../build-parameters';
import CloudRunnerOptions from '../cloud-runner-options';

// import CloudRunner from '../cloud-runner';
// import ImageEnvironmentFactory from '../../image-environment-factory';
import * as core from '@actions/core';

export class TaskParameterSerializer {
  static readonly blocked = new Set(['0', 'length', 'prototype', '', 'unityVersion']);
  public static readBuildEnvironmentVariables(buildParameters: BuildParameters): CloudRunnerEnvironmentVariable[] {
    return [
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
          x.value !== `undefined`,
      )
      .map((x) => {
        x.name = TaskParameterSerializer.ToEnvVarFormat(x.name);
        x.value = `${x.value}`;
        if (buildParameters.cloudRunnerIntegrationTests) {
          if (Number(x.name) === Number.NaN) {
            core.info(`[ERROR] found a number in task param serializer ${JSON.stringify(x)}`);
          } else {
            core.info(`${JSON.stringify(x)}`);
          }
        }

        return x;
      });
  }

  public static readBuildParameterFromEnvironment(): BuildParameters {
    const buildParameters = new BuildParameters();
    const keys = Object.keys(buildParameters);
    for (const element of keys) {
      buildParameters[TaskParameterSerializer.UndoEnvVarFormat(element, buildParameters)] =
        process.env[
          TaskParameterSerializer.ToEnvVarFormat(`GAMECI-${TaskParameterSerializer.ToEnvVarFormat(element)}`)
        ];
    }

    return buildParameters;
  }

  private static readInput() {
    return TaskParameterSerializer.serializeFromType(Input);
  }

  public static ToEnvVarFormat(input): string {
    return CloudRunnerOptions.ToEnvVarFormat(input);
  }

  public static UndoEnvVarFormat(element, buildParameters): string {
    return (
      Object.keys(buildParameters).find((x) => `GAMECI-${TaskParameterSerializer.ToEnvVarFormat(x)}` === element) || ''
    );
  }

  private static serializeFromObject(buildParameters) {
    const array: any[] = [];
    const keys = Object.keys(buildParameters);
    for (const element of keys) {
      array.push(
        {
          name: `GAMECI-${TaskParameterSerializer.ToEnvVarFormat(element)}`,
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

    // array.push(
    //   ...ImageEnvironmentFactory.getEnvironmentVariables(CloudRunner.buildParameters)
    //     .filter((x) => array.every((y) => y.ParameterKey !== x.name))
    //     .map((x) => {
    //       return {
    //         ParameterKey: x.name,
    //         EnvironmentVariable: x.name,
    //         ParameterValue: x.value,
    //       };
    //     }),
    // );

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
