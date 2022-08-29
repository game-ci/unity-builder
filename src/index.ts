import { Cli } from './cli.ts';

class GameCI {
  public static async run() {
    try {
      const { command, options } = await new Cli().validateAndParseArguments();

      const success = await command.execute(options);

      if (!success) throw new Error(`${command.name} failed.`);
    } catch (error) {
      // eslint-disable-next-line no-console
      console.error(error);
      Deno.exit(1);
    }
  }
}

await GameCI.run();
