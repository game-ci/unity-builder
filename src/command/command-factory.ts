import { NonExistentCommand } from './null/non-existent-command.ts';
import { UnityBuildCommand } from './build/unity-build-command.ts';
import { CommandInterface } from './command-interface.ts';
import { Engine } from '../model/engine/engine.ts';
import { OpenConfigFolderCommand } from './config/open-config-folder-command.ts';

export class CommandFactory {
  constructor() {}

  selectEngine(engine: string, engineVersion: string) {
    this.engine = engine;
    this.engineVersion = engineVersion;

    return this;
  }

  public createCommand(commandArray: string[]): CommandInterface {
    // Structure looks like:  _: [ "build" ], or _: [ "config", "open" ]
    const [command, ...subCommands] = commandArray;

    if (command === 'config') {
      return this.createConfigCommand(command, subCommands);
    }

    switch (this.engine) {
      case Engine.unity:
        return this.createUnityCommand(command, subCommands);
      default:
        throw new Error(`Engine ${this.engine} is not yet supported.`);
    }
  }

  private createConfigCommand(command: string, subCommands: string[]) {
    switch (subCommands[0]) {
      case 'open':
        return new OpenConfigFolderCommand(command);
      default:
        return new NonExistentCommand([command, ...subCommands].join(' '));
    }
  }

  private createUnityCommand(command: string, subCommands: string[]) {
    switch (command) {
      case 'build':
        return new UnityBuildCommand(command);

      // case 'remote-build':
      //   return new UnityRemoteBuildCommand(commandName);
      default:
        return new NonExistentCommand([command, ...subCommands].join(' '));
    }
  }
}
