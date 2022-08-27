import { Options } from '../config/options.ts';
import { Input } from '../model/index.ts';
import Parameters from '../model/parameters.ts';
import { CommandInterface } from './command-interface.ts';

export class CommandBase implements CommandInterface {
  public readonly name: string;
  private options: Options;

  constructor(name: string) {
    this.name = name;
  }

  public async execute(): Promise<boolean> {
    throw new Error('Method not implemented.');
  }
}
