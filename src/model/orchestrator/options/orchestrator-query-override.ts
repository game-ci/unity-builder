import Input from '../../input';
import { GenericInputReader } from '../../input-readers/generic-input-reader';
import OrchestratorOptions from './orchestrator-options';

const formatFunction = (value: string, arguments_: any[]) => {
  for (const element of arguments_) {
    value = value.replace(`{${element.key}}`, element.value);
  }

  return value;
};

class OrchestratorQueryOverride {
  static queryOverrides: { [key: string]: string } | undefined;

  // TODO accept premade secret sources or custom secret source definition yamls

  public static query(key: string, alternativeKey: string) {
    if (OrchestratorQueryOverride.queryOverrides && OrchestratorQueryOverride.queryOverrides[key] !== undefined) {
      return OrchestratorQueryOverride.queryOverrides[key];
    }
    if (
      OrchestratorQueryOverride.queryOverrides &&
      alternativeKey &&
      OrchestratorQueryOverride.queryOverrides[alternativeKey] !== undefined
    ) {
      return OrchestratorQueryOverride.queryOverrides[alternativeKey];
    }

    return;
  }

  private static shouldUseOverride(query: string) {
    if (OrchestratorOptions.inputPullCommand !== '') {
      if (OrchestratorOptions.pullInputList.length > 0) {
        const doesInclude =
          OrchestratorOptions.pullInputList.includes(query) ||
          OrchestratorOptions.pullInputList.includes(Input.ToEnvVarFormat(query));

        return doesInclude ? true : false;
      } else {
        return true;
      }
    }
  }

  private static async queryOverride(query: string) {
    if (!this.shouldUseOverride(query)) {
      throw new Error(`Should not be trying to run override query on ${query}`);
    }

    return await GenericInputReader.Run(
      formatFunction(OrchestratorOptions.inputPullCommand, [{ key: 0, value: query }]),
    );
  }

  public static async PopulateQueryOverrideInput() {
    const queries = OrchestratorOptions.pullInputList;
    OrchestratorQueryOverride.queryOverrides = {};
    for (const element of queries) {
      if (OrchestratorQueryOverride.shouldUseOverride(element)) {
        OrchestratorQueryOverride.queryOverrides[element] = await OrchestratorQueryOverride.queryOverride(element);
      }
    }
  }
}
export default OrchestratorQueryOverride;
