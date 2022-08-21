import { configSync } from './dependencies.ts';
import { configureLogger } from './core/logger/index.ts';
import { Options } from './config/options.ts';
import { CommandFactory } from './commands/command-factory.ts';
import { ArgumentsParser } from './core/cli/arguments-parser.ts';
import { Environment } from './core/env/environment.ts';
import { EngineDetector } from './core/engine/engine-detector.ts';

export class GameCI {
  private readonly env: Environment;

  constructor() {
    this.env = new Environment(Deno.env, configSync());
    this.args = Deno.args;
  }

  public async run() {
    try {
      // Infallible configuration
      const { commandName, subCommands, args, verbosity } = new ArgumentsParser().parse(this.args);
      await configureLogger(verbosity);

      // Determine which command to run
      const { engine, engineVersion } = await new EngineDetector(subCommands, args).detect();
      const command = new CommandFactory().selectEngine(engine, engineVersion).createCommand(commandName, subCommands);

      // Provide the command with options
      const options = await new Options(command, this.env).generateParameters(args);
      await command.configure(options).validate();

      // Execute
      if (log.isVerbose) log.info('Executing', command.name);
      const success = await command.execute();
      if (!success) log.info(`Command ${command.name} failed.`);
    } catch (error) {
      log.error(error);
      Deno.exit(1);
    }
  }
}

await new GameCI().run();
