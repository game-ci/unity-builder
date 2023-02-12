import BuildParameters from '../../build-parameters';
import { Cli } from '../../cli/cli';

export async function CreateParameters(overrides) {
  if (overrides) Cli.options = overrides;

  return BuildParameters.create();
}
