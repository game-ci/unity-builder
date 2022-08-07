import { NonExistentCommand } from './command/non-existent-command.ts';
import { BuildCommand } from './command/build-command.ts';
import { BuildRemoteCommand } from './command/build-remote-command.ts';

export class CommandFactory {
  constructor() {}

  public createCommand(commandName) {
    switch (commandName) {
      case 'build':
        return new BuildCommand();
      case 'build-remote':
        return new BuildRemoteCommand();
      default:
        return new NonExistentCommand(commandName);
    }
  }
}
