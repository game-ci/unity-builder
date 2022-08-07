import { CommandInterface } from './command-interface.ts';
import { Options } from '../../config/options.ts';

export class NonExistentCommand implements CommandInterface {
  public name: string;

  constructor(name: string) {
    this.name = name;
  }

  public async execute(options: Options): Promise<boolean> {
    throw new Error(`Command ${this.name} does not exist`);
  }
}
