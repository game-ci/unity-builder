import { Input } from '../..';
import ImageEnvironmentFactory from '../../image-environment-factory';
import CloudRunnerEnvironmentVariable from './cloud-runner-environment-variable';
import { CloudRunnerState } from '../state/cloud-runner-state';
import { CloudRunnerBuildCommandProcessor } from './cloud-runner-build-command-process';

export class TaskParameterSerializer {
  public static readBuildEnvironmentVariables(): CloudRunnerEnvironmentVariable[] {
    TaskParameterSerializer.setupDefaultSecrets();
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
    const configurableHooks = CloudRunnerBuildCommandProcessor.getHooks();
    const secrets = configurableHooks
      .map((x) => x.secrets)
      // eslint-disable-next-line unicorn/no-array-reduce
      .reduce((x, y) => [...x, ...y]);
    array.push(secrets);

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
    const keys = Object.keys(CloudRunnerState.buildParams);
    for (const element of keys) {
      array.push({
        name: element,
        value: CloudRunnerState.buildParams[element],
      });
    }
    array.push({ name: 'buildParameters', value: JSON.stringify(CloudRunnerState.buildParams) });
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
    if (CloudRunnerState.defaultSecrets === undefined)
      CloudRunnerState.defaultSecrets = ImageEnvironmentFactory.getEnvironmentVariables(
        CloudRunnerState.buildParams,
      ).map((x) => {
        return {
          ParameterKey: x.name,
          EnvironmentVariable: x.name,
          ParameterValue: x.value,
        };
      });
  }
}
