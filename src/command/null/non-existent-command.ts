import { CommandInterface } from '../command-interface.ts';
import { YargsInstance, YargsArguments } from '../../dependencies.ts';
import { CommandBase } from '../command-base.ts';

export class NonExistentCommand extends CommandBase implements CommandInterface {
  public execute(options: YargsArguments): Promise<boolean> {
    throw new Error(`Command "${this.name}" does not exist`);
  }

  public async configureOptions(yargs: YargsInstance): Promise<void> {}
}
