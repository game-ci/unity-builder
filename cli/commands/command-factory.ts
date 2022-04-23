import { NonExistentCommand } from './command/non-existent-command.ts';
import { BuildCommand } from './command/build-command.ts';

export class CommandFactory {
  constructor() {}

  public createCommand(commandName) {
    switch (commandName) {
      case 'build':
        return new BuildCommand();
      default:
        return new NonExistentCommand(commandName);
    }
  }
}
