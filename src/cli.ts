import yargs from 'https://deno.land/x/yargs@v17.5.1-deno/deno.ts';
import { default as getHomeDir } from 'https://deno.land/x/dir@1.5.1/home_dir/mod.ts';
import { engineDetection } from './middleware/engine-detection/index.ts';
import { CommandInterface } from './command/command-interface.ts';
import { configureLogger } from './middleware/logger-verbosity/index.ts';
import { CommandFactory } from './command/command-factory.ts';

export class Cli {
  private readonly yargs: yargs.Argv;
  private readonly cliStorageAbsolutePath: string;
  private readonly cliStorageCanonicalPath: string;
  private readonly configFileName: string;
  private command: CommandInterface;

  constructor() {
    this.cliStorageAbsolutePath = `${getHomeDir()}/.game-ci`;
    this.cliStorageCanonicalPath = '~/.game-ci';
    this.configFileName = 'config.json';
    this.yargs = yargs(Deno.args);
  }

  public async validateAndParseArguments() {
    this.globalSettings();
    this.configureLogger();
    this.globalOptions();

    await this.registerBuildCommand();

    await this.parse();

    return {
      command: this.command,
      options: this.options,
    };
  }

  private globalSettings() {
    const defaultCanonicalPath = `${this.cliStorageCanonicalPath}/${this.configFileName}`;
    const defaultAbsolutePath = `${this.cliStorageAbsolutePath}/${this.configFileName}`;

    this.yargs
      .config('config', `default: ${defaultCanonicalPath}`, async (override) => {
        const configPath = override || defaultAbsolutePath;

        return JSON.parse(await Deno.readTextFile(configPath));
      })
      .parserConfiguration({
        'dot-notation': false,
        'duplicate-arguments-array': false,
        'negation-prefix': false,
        'strip-aliased': true,
        'strip-dashed': true,
      });

    // Todo - enable `.env()` after this is merged: https://github.com/yargs/yargs/pull/2231
    // this.yargs.env();
  }

  private configureLogger() {
    this.yargs
      .options('quiet', {
        alias: 'q',
        default: false,
        description: 'Suppress all output',
        type: 'boolean',
      })
      .options('verbose', {
        alias: 'v',
        default: false,
        description: 'Enable verbose logging',
        type: 'boolean',
      })
      .options('veryVerbose', {
        alias: 'vv',
        default: false,
        description: 'Enable very verbose logging',
        type: 'boolean',
      })
      .options('maxVerbose', {
        alias: 'vvv',
        default: false,
        description: 'Enable debug logging',
      })
      .middleware([configureLogger], true);
  }

  private globalOptions() {
    this.yargs
      .epilogue('for more information, find our manual at https://game.ci/docs/cli')
      .middleware([])
      .showHelpOnFail(true)
      .strict(true);
  }

  private async registerBuildCommand() {
    this.yargs.command('build [projectPath]', 'Builds a project that you want to build', async (yargs) => {
      yargs
        .positional('projectPath', {
          describe: 'Path to the project',
          type: 'string',
        })
        .middleware([
          engineDetection, // Command is engine specific
          async (args) => {
            await this.registerCommand(args, yargs);
          },
        ]);
    });
  }

  private async registerCommand(args: yargs.Arguments, yargs) {
    const { engine, engineVersion, _: command } = args;

    this.command = new CommandFactory().selectEngine(engine, engineVersion).createCommand(command);

    await this.command.configureOptions(yargs);
  }

  private async parse() {
    this.options = await this.yargs.parseAsync();
  }
}
