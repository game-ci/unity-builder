import { BuildParameters } from '../model';
import { Cli } from '../model/cli/cli';
import { OptionValues } from 'commander';

export const TIMEOUT_INFINITE = 1e9;

export async function createParameters(overrides?: OptionValues) {
  if (overrides) Cli.options = overrides;

  return BuildParameters.create();
}
