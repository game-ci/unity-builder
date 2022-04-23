import { Options } from '../../config/options.ts';

export interface CommandInterface {
  name: string;
  execute: (options: Options) => Promise<void>;
}
