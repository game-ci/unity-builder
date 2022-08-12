import { Options } from '../../config/options.ts';
import Parameters from '../../model/parameters.ts';
import { Input } from '../../model/index.ts';

export interface CommandInterface {
  name: string;
  execute: (options: Options) => Promise<boolean>;
  parseParameters: (input: Input, parameters: Parameters) => Promise<Partial<Parameters>>;
}
