import { CommandInterface } from './CommandInterface.ts';
import { Options } from '../../config/options.ts';

export class NonExistentCommand implements CommandInterface {
  public name: string;

  constructor(name: string) {
    this.name = name;
  }

  public async execute(options: Options) {
    throw new Error(`Command ${this.name} does not exist`);
  }
}
