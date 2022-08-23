import Input from '../../input';
import { GenericInputReader } from '../../input-readers/generic-input-reader';
import CloudRunnerOptions from '../cloud-runner-options';

const formatFunction = (value, arguments_) => {
  for (const element of arguments_) {
    value = value.replace(`{${element.key}}`, element.value);
  }

  return value;
};

class CloudRunnerQueryOverride {
  static queryOverrides: any;

  // TODO accept premade secret sources or custom secret source definition yamls

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
    if (CloudRunnerOptions.readInputOverrideCommand() !== '') {
      if (CloudRunnerOptions.readInputFromOverrideList() !== '') {
        const doesInclude =
          CloudRunnerOptions.readInputFromOverrideList().split(',').includes(query) ||
          CloudRunnerOptions.readInputFromOverrideList().split(',').includes(Input.ToEnvVarFormat(query));

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

    return await GenericInputReader.Run(
      formatFunction(CloudRunnerOptions.readInputOverrideCommand(), [{ key: 0, value: query }]),
    );
  }

  public static async PopulateQueryOverrideInput() {
    const queries = CloudRunnerOptions.readInputFromOverrideList().split(',');
    CloudRunnerQueryOverride.queryOverrides = new Array();
    for (const element of queries) {
      if (CloudRunnerQueryOverride.shouldUseOverride(element)) {
        CloudRunnerQueryOverride.queryOverrides[element] = await CloudRunnerQueryOverride.queryOverride(element);
      }
    }
  }
}
export default CloudRunnerQueryOverride;
