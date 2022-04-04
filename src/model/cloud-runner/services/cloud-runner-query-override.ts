import Input from '../../input';
import { GenericInputReader } from '../../input-readers/generic-input-reader';

const formatFunction = (value, arguments_) => {
  for (const element of arguments_) {
    value = value.replace(`{${element.key}}`, element.value);
  }
  return value;
};

class CloudRunnerQueryOverride {
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
    Input.queryOverrides = new Array();
    for (const element of queries) {
      if (CloudRunnerQueryOverride.shouldUseOverride(element)) {
        Input.queryOverrides[element] = await CloudRunnerQueryOverride.queryOverride(element);
      }
    }
  }
}
export default CloudRunnerQueryOverride;
