import { CloudRunner, Input } from '../..';
import ImageEnvironmentFactory from '../../image-environment-factory';
import CloudRunnerEnvironmentVariable from './cloud-runner-environment-variable';
import { CloudRunnerBuildCommandProcessor } from './cloud-runner-build-command-process';

export class TaskParameterSerializer {
  public static readBuildEnvironmentVariables(): CloudRunnerEnvironmentVariable[] {
    TaskParameterSerializer.setupDefaultSecrets();
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
        value: CloudRunner.buildParameters.platform,
      },
      {
        name: 'UNITY_SERIAL',
        value: Input.unitySerial,
      },
      {
        name: 'UNITY_USERNAME',
        value: Input.unityUsername,
      },
      {
        name: 'UNITY_PASSWORD',
        value: Input.unityPassword,
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

  private static setupDefaultSecrets() {
    if (CloudRunner.defaultSecrets === undefined)
      CloudRunner.defaultSecrets = ImageEnvironmentFactory.getEnvironmentVariables(CloudRunner.buildParameters).map(
        (x) => {
          return {
            ParameterKey: x.name,
            EnvironmentVariable: x.name,
            ParameterValue: x.value,
          };
        },
      );
  }
}
