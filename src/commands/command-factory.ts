import { NonExistentCommand } from './command/non-existent-command.ts';
import { BuildCommand } from './command/unity/build-command.ts';
import { BuildRemoteCommand } from './command/unity/build-remote-command.ts';
import { CommandInterface } from './command/command-interface.ts';

export class CommandFactory {
  constructor() {}

  selectEngine(engine: string, engineVersion: string) {
    this.engine = engine;
    this.engineVersion = engineVersion;

    return this;
  }

  public createCommand(commandName: string): CommandInterface {
    switch (this.engine) {
      case 'unity':
        return this.createUnityCommand(commandName);
      default:
        throw new Error(`Engine ${this.engine} is not yet supported.`);
    }
  }

  private createUnityCommand(commandName: string) {
    switch (commandName) {
      case 'build':
        return new BuildCommand(commandName);
      case 'build-remote':
        return new BuildRemoteCommand(commandName);
      default:
        return new NonExistentCommand(commandName);
    }
  }
}
