import { NonExistentCommand } from './null/non-existent-command.ts';
import { UnityBuildCommand } from './build/unity-build-command.ts';
import { CommandInterface } from './command-interface.ts';
import { UnityRemoteBuildCommand } from './remote/unity-remote-build-command.ts';

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
        return new UnityBuildCommand(commandName);
      case 'build-remote':
        return new UnityRemoteBuildCommand(commandName);
      default:
        return new NonExistentCommand(commandName);
    }
  }
}
