import Input from '../../input.ts';
import { GenericInputReader } from '../../input-readers/generic-input-reader.ts';

const formatFunction = (value, arguments_) => {
  for (const element of arguments_) {
    value = value.replace(`{${element.key}}`, element.value);
  }

  return value;
};

class CloudRunnerQueryOverride {
  static queryOverrides: any;

  public static query(key, alternativeKey) {
    if (CloudRunnerQueryOverride.queryOverrides && CloudRunnerQueryOverride.queryOverrides[key] !== undefined) {
      return CloudRunnerQueryOverride.queryOverrides[key];
    }
    if (
      CloudRunnerQueryOverride.queryOverrides &&
      alternativeKey &&
      CloudRunnerQueryOverride.queryOverrides[alternativeKey] !== undefined
    ) {
      return CloudRunnerQueryOverride.queryOverrides[alternativeKey];
    }

    return;
  }

  private static shouldUseOverride(query) {
    if (Input.readInputOverrideCommand() !== '') {
      if (Input.readInputFromOverrideList() !== '') {
        const doesInclude =
          Input.readInputFromOverrideList().split(',').includes(query) ||
          Input.readInputFromOverrideList().split(',').includes(Input.ToEnvVarFormat(query));

        return doesInclude ? true : false;
      } else {
        return true;
      }
    }
  }

  private static async queryOverride(query) {
    if (!this.shouldUseOverride(query)) {
      throw new Error(`Should not be trying to run override query on ${query}`);
    }

    return await GenericInputReader.Run(formatFunction(Input.readInputOverrideCommand(), [{ key: 0, value: query }]));
  }

  public static async PopulateQueryOverrideInput() {
    const queries = Input.readInputFromOverrideList().split(',');
    CloudRunnerQueryOverride.queryOverrides = new Array();
    for (const element of queries) {
      if (CloudRunnerQueryOverride.shouldUseOverride(element)) {
        CloudRunnerQueryOverride.queryOverrides[element] = await CloudRunnerQueryOverride.queryOverride(element);
      }
    }
  }
}
export default CloudRunnerQueryOverride;
