import { CloudRunner, Input } from '../../index.ts';
import ImageEnvironmentFactory from '../../image-environment-factory.ts';
import CloudRunnerEnvironmentVariable from './cloud-runner-environment-variable.ts';
import { CloudRunnerBuildCommandProcessor } from './cloud-runner-build-command-process.ts';
import CloudRunnerSecret from './cloud-runner-secret.ts';
import CloudRunnerQueryOverride from './cloud-runner-query-override.ts';

export class TaskParameterSerializer {
  public static readBuildEnvironmentVariables(): CloudRunnerEnvironmentVariable[] {
    return [
      {
        name: 'ContainerMemory',
        value: CloudRunner.buildParameters.cloudRunnerMemory,
      },
      {
        name: 'ContainerCpu',
        value: CloudRunner.buildParameters.cloudRunnerCpu,
      },
      {
        name: 'BUILD_TARGET',
        value: CloudRunner.buildParameters.targetPlatform,
      },
      ...TaskParameterSerializer.serializeBuildParamsAndInput,
    ];
  }
  private static get serializeBuildParamsAndInput() {
    let array = new Array();
    array = TaskParameterSerializer.readBuildParameters(array);
    array = TaskParameterSerializer.readInput(array);
    const configurableHooks = CloudRunnerBuildCommandProcessor.getHooks(CloudRunner.buildParameters.customJobHooks);
    const secrets = configurableHooks.map((x) => x.secrets).filter((x) => x !== undefined && x.length > 0);
    if (secrets.length > 0) {
      // eslint-disable-next-line unicorn/no-array-reduce
      array.push(secrets.reduce((x, y) => [...x, ...y]));
    }

    array = array.filter(
      (x) => x.value !== undefined && x.name !== '0' && x.value !== '' && x.name !== 'prototype' && x.name !== 'length',
    );
    array = array.map((x) => {
      x.name = Input.ToEnvVarFormat(x.name);
      x.value = `${x.value}`;

      return x;
    });

    return array;
  }

  private static readBuildParameters(array: any[]) {
    const keys = Object.keys(CloudRunner.buildParameters);
    for (const element of keys) {
      array.push({
        name: element,
        value: CloudRunner.buildParameters[element],
      });
    }
    array.push({ name: 'buildParameters', value: JSON.stringify(CloudRunner.buildParameters) });

    return array;
  }

  private static readInput(array: any[]) {
    const input = Object.getOwnPropertyNames(Input);
    for (const element of input) {
      if (typeof Input[element] !== 'function' && array.filter((x) => x.name === element).length === 0) {
        array.push({
          name: element,
          value: `${Input[element]}`,
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
    array.push(
      ...ImageEnvironmentFactory.getEnvironmentVariables(CloudRunner.buildParameters)
        .filter((x) => array.every((y) => y.ParameterKey !== x.name))
        .map((x) => {
          return {
            ParameterKey: x.name,
            EnvironmentVariable: x.name,
            ParameterValue: x.value,
          };
        }),
    );

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
    if (value !== undefined && value !== '') {
      array.push({
        ParameterKey: key,
        EnvironmentVariable: key,
        ParameterValue: value,
      });
    }

    return array;
  }
}
