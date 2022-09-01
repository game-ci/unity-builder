import { YargsInstance, YargsArguments } from '../dependencies.ts';

export interface CommandInterface {
  name: string;
  execute: (options: YargsArguments) => Promise<boolean>;
  configureOptions: (instance: YargsInstance) => Promise<void>;
}
