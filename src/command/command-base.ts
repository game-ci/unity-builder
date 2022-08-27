import { Options } from '../config/options.ts';
import { Input } from '../model/index.ts';
import Parameters from '../model/parameters.ts';

export class CommandBase {
  public readonly name: string;
  private options: Options;

  constructor(name: string) {
    this.name = name;
  }

  public configure(options: Options): this {
    this.options = options;

    return this;
  }

  public async validate(): Promise<this> {
    return this;
  }

  public async parseParameters(input: Input, parameters: Parameters): Promise<Partial<Parameters>> {
    return {};
  }

  public async execute(): Promise<boolean> {
    throw new Error('Method not implemented.');
  }
}
