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

export class TaskParameterSerializer {
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
      ...TaskParameterSerializer.serializeBuildParamsAndInput(buildParameters),
    ];
  }
  private static serializeBuildParamsAndInput(buildParameters: BuildParameters) {
    let array = new Array();
    array = TaskParameterSerializer.readBuildParameters(array, buildParameters);
    array = TaskParameterSerializer.readInput(array);
    const configurableHooks = CloudRunnerCustomHooks.getHooks(buildParameters.customJobHooks);
    const secrets = configurableHooks.map((x) => x.secrets).filter((x) => x !== undefined && x.length > 0);
    if (secrets.length > 0) {
      // eslint-disable-next-line unicorn/no-array-reduce
      array.push(secrets.reduce((x, y) => [...x, ...y]));
    }

    const blocked = new Set(['0', 'length', 'prototype', '', 'unityVersion']);

    array = array.filter((x) => !blocked.has(x.name));
    array = array.map((x) => {
      x.name = Input.ToEnvVarFormat(x.name);
      x.value = `${x.value}`;

      return x;
    });

    return array;
  }

  public static readBuildParameterFromEnvironment(): BuildParameters {
    const buildParameters = new BuildParameters();
    const keys = Object.keys(BuildParameters);
    for (const element of keys) {
      buildParameters[element] = process.env[CloudRunnerOptions.ToEnvVarFormat(`param-${element}`)];
    }

    return buildParameters;
  }
  public static readBuildParameters(array: any[], buildParameters: BuildParameters) {
    const keys = Object.keys(buildParameters);
    for (const element of keys) {
      array.push(
        {
          name: `PARAM-${CloudRunnerOptions.ToEnvVarFormat(element)}`,
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

  private static readInput(array: any[]) {
    const input = CloudRunnerOptionsReader.GetProperties();
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
