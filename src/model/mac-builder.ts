import { BuildParameters } from '.';

class MacBuilder {
  public static async run(actionFolder, workspace, buildParameters: BuildParameters) {
    //make linter happy
    if (actionFolder !== undefined && workspace !== undefined && buildParameters !== undefined) {
      return;
    }
  }
}

export default MacBuilder;
