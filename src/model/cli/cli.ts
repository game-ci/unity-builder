import { Command } from 'commander-ts';
import { Input } from '..';
import * as core from '@actions/core';
import { ActionYamlReader } from '../input-readers/action-yaml';
import { CliFunction, CliFunctionsRepository } from './cli-functions-repository';
import { OptionValues } from 'commander';
import { InputKey } from '../input';

export class Cli {
  public static options: OptionValues | undefined;
  static get isCliMode() {
    return Cli.options !== undefined && Cli.options.mode !== undefined && Cli.options.mode !== '';
  }
  public static query(key: string, alternativeKey: string) {
    if (Cli.options && Cli.options[key] !== undefined) {
      return Cli.options[key];
    }
    if (Cli.options && alternativeKey && Cli.options[alternativeKey] !== undefined) {
      return Cli.options[alternativeKey];
    }

    return;
  }

  public static InitCliMode() {
    const program = new Command();
    program.version('0.0.1');

    const actionYamlReader: ActionYamlReader = new ActionYamlReader();
    const properties = Object.getOwnPropertyNames(Input).filter(
      (p) => p !== 'length' && p !== 'prototype' && p !== 'name',
    );
    for (const element of properties) {
      program.option(`--${element} <${element}>`, actionYamlReader.GetActionYamlValue(element));
    }
    program.option(
      '-m, --mode <mode>',
      CliFunctionsRepository.GetAllCliModes()
        .map((x) => `${x.key} (${x.description})`)
        .join(` | `),
    );
    program.option('--populateOverride <populateOverride>', 'should use override query to pull input false by default');
    program.option('--cachePushFrom <cachePushFrom>', 'cache push from source folder');
    program.option('--cachePushTo <cachePushTo>', 'cache push to caching folder');
    program.option('--artifactName <artifactName>', 'caching artifact name');
    program.option('--select <select>', 'select a particular resource');
    program.option('--logFile <logFile>', 'output to log file (log stream only)');
    program.option('--profilePath <profilePath>', 'path to submodule profile YAML');
    program.option('--variantPath <variantPath>', 'path to submodule variant YAML');
    program.option('--agentPath <agentPath>', 'path to custom LFS transfer agent');
    program.option('--agentArgs <agentArgs>', 'arguments for custom LFS transfer agent');
    program.option('--storagePaths <storagePaths>', 'semicolon-separated storage paths for LFS agent');
    program.parse(process.argv);
    Cli.options = program.opts();

    return Cli.isCliMode;
  }

  static async RunCli(): Promise<void> {
    const results = CliFunctionsRepository.GetCliFunctions(Cli.options?.mode);
    if (!results) {
      throw new Error(
        `Unknown CLI mode: ${Cli.options?.mode}. Orchestrator CLI features require @game-ci/orchestrator.`,
      );
    }
    core.info(`Entrypoint: ${results.key}`);
    Cli.options!.versioning = 'None';

    return await results.target[results.propertyKey](Cli.options);
  }

  @CliFunction(`print-input`, `prints all input`)
  private static logInput() {
    core.info(`\n`);
    core.info(`INPUT:`);
    const properties = Object.getOwnPropertyNames(Input).filter(
      (p) => p !== 'length' && p !== 'prototype' && p !== 'name',
    );
    for (const element of properties) {
      if (
        element in Input &&
        Input[element as InputKey] !== undefined &&
        Input[element as InputKey] !== '' &&
        typeof Input[element as InputKey] !== `function` &&
        element !== 'length' &&
        element !== 'cliOptions' &&
        element !== 'prototype'
      ) {
        core.info(`${element} ${Input[element as InputKey]}`);
      }
    }
    core.info(`\n`);
  }
}
