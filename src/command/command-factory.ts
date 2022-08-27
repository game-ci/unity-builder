import { NonExistentCommand } from './null/non-existent-command.ts';
import { UnityBuildCommand } from './build/unity-build-command.ts';
import { CommandInterface } from './command-interface.ts';
import { UnityRemoteBuildCommand } from './remote/unity-remote-build-command.ts';
import { Engine } from '../model/engine.ts';

export class CommandFactory {
  constructor() {}

  selectEngine(engine: string, engineVersion: string) {
    this.engine = engine;
    this.engineVersion = engineVersion;

    return this;
  }

  public createCommand(command: string[]): CommandInterface {
    // Structure looks like:  _: [ "build" ],
    const commandName = command[0];

    switch (this.engine) {
      case Engine.unity:
        return this.createUnityCommand(commandName);
      default:
        throw new Error(`Engine ${this.engine} is not yet supported.`);
    }
  }

  private createUnityCommand(commandName: string) {
    switch (commandName) {
      case 'build':
        return new UnityBuildCommand(commandName);

      // case 'remote-build':
      //   return new UnityRemoteBuildCommand(commandName);
      // default:
      //   return new NonExistentCommand(commandName);
    }
  }
}
