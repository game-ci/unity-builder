import { Cli } from './cli.ts';

class GameCI {
  public static async run() {
    try {
      const { command, options } = await new Cli().validateAndParseArguments();

      const success = await command.execute(options);

      if (success) {
        log.info(`${command.name} done.`);
      } else {
        log.warning(`${command.constructor.name} failed.`);
      }
    } catch (error) {
      log.error(error);
      Deno.exit(1);
    }
  }
}

await GameCI.run();
