import { CommandInterface } from './command-interface.ts';
import { YargsArguments, YargsInstance } from '../dependencies.ts';

export class CommandBase implements CommandInterface {
  public readonly name: string;

  constructor(name: string) {
    this.name = name.charAt(0).toUpperCase() + name.slice(1);
  }

  public execute(options: YargsArguments): Promise<boolean> {
    throw new Error('Method not implemented.');
  }

  public configureOptions(yargs: YargsInstance): Promise<void> {
    throw new Error('Method not implemented.');
  }
}
