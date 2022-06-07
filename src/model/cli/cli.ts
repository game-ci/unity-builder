import { Command } from '../../../node_modules/commander-ts';
import { BuildParameters, CloudRunner, ImageTag, Input } from '../index.ts';
import * as core from '../../../node_modules/@actions/core';
import { ActionYamlReader } from '../input-readers/action-yaml.ts';
import CloudRunnerLogger from '../cloud-runner/services/cloud-runner-logger.ts';
import CloudRunnerQueryOverride from '../cloud-runner/services/cloud-runner-query-override.ts';
import { CliFunction, CliFunctionsRepository } from './cli-functions-repository.ts';
import { AwsCliCommands } from '../cloud-runner/providers/aws/commands/aws-cli-commands.ts';
import { Caching } from '../cloud-runner/remote-client/caching.ts';
import { LfsHashing } from '../cloud-runner/services/lfs-hashing.ts';
import { RemoteClient } from '../cloud-runner/remote-client/index.ts';

export class Cli {
  public static options;
  static get isCliMode() {
    return Cli.options !== undefined && Cli.options.mode !== undefined && Cli.options.mode !== '';
  }
  public static query(key, alternativeKey) {
    if (Cli.options && Cli.options[key] !== undefined) {
      return Cli.options[key];
    }
    if (Cli.options && alternativeKey && Cli.options[alternativeKey] !== undefined) {
      return Cli.options[alternativeKey];
    }

    return;
  }

  public static InitCliMode() {
    CliFunctionsRepository.PushCliFunctionSource(AwsCliCommands);
    CliFunctionsRepository.PushCliFunctionSource(Caching);
    CliFunctionsRepository.PushCliFunctionSource(LfsHashing);
    CliFunctionsRepository.PushCliFunctionSource(RemoteClient);
    const program = new Command();
    program.version('0.0.1');
    const properties = Object.getOwnPropertyNames(Input);
    const actionYamlReader: ActionYamlReader = new ActionYamlReader();
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
    program.parse(process.argv);
    Cli.options = program.opts();

    return Cli.isCliMode;
  }

  static async RunCli(): Promise<void> {
    Input.githubInputEnabled = false;
    if (Cli.options['populateOverride'] === `true`) {
      await CloudRunnerQueryOverride.PopulateQueryOverrideInput();
    }
    Cli.logInput();
    const results = CliFunctionsRepository.GetCliFunctions(Cli.options.mode);
    CloudRunnerLogger.log(`Entrypoint: ${results.key}`);
    Cli.options.versioning = 'None';

    return await results.target[results.propertyKey]();
  }

  @CliFunction(`print-input`, `prints all input`)
  private static logInput() {
    core.info(`\n`);
    core.info(`INPUT:`);
    const properties = Object.getOwnPropertyNames(Input);
    for (const element of properties) {
      if (
        Input[element] !== undefined &&
        Input[element] !== '' &&
        typeof Input[element] !== `function` &&
        element !== 'length' &&
        element !== 'cliOptions' &&
        element !== 'prototype'
      ) {
        core.info(`${element} ${Input[element]}`);
      }
    }
    core.info(`\n`);
  }

  @CliFunction(`cli`, `runs a cloud runner build`)
  public static async CLIBuild(): Promise<string> {
    const buildParameter = await BuildParameters.create();
    const baseImage = new ImageTag(buildParameter);

    return await CloudRunner.run(buildParameter, baseImage.toString());
  }
}
