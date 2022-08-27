import { Options } from '../config/options.ts';
import { yargs } from '../dependencies.ts';

export interface CommandInterface {
  name: string;
  execute: (options: Options) => Promise<boolean>;
  configureOptions: (instance: yargs.Argv) => Promise<void>;
}
