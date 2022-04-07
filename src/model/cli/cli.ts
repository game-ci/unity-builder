import { Command } from 'commander-ts';
import { BuildParameters, CloudRunner, ImageTag, Input } from '..';
import * as core from '@actions/core';
import { ActionYamlReader } from '../input-readers/action-yaml';
import CloudRunnerLogger from '../cloud-runner/services/cloud-runner-logger';
import CloudRunnerQueryOverride from '../cloud-runner/services/cloud-runner-query-override';
import { CliFunction, CLIFunctionsRepository } from './cli-functions-repository';
import { AWSCLICommands } from '../cloud-runner/cloud-runner-providers/aws/commands/aws-cli-commands';
import { Caching } from '../cloud-runner/remote-client/caching';
import { LFSHashing } from '../cloud-runner/remote-client/lfs-hashing';
import { SetupCloudRunnerRepository } from '../cloud-runner/remote-client/setup-cloud-runner-repository';

export class CLI {
  public static options;
  static get cliMode() {
    return CLI.options !== undefined && CLI.options.mode !== undefined && CLI.options.mode !== '';
  }
  public static query(key, alternativeKey) {
    if (CLI.options && CLI.options[key] !== undefined) {
      return CLI.options[key];
    }
    if (CLI.options && alternativeKey && CLI.options[alternativeKey] !== undefined) {
      return CLI.options[alternativeKey];
    }
    return;
  }

  public static InitCliMode() {
    CLIFunctionsRepository.PushCliFunctionSource(AWSCLICommands);
    CLIFunctionsRepository.PushCliFunctionSource(Caching);
    CLIFunctionsRepository.PushCliFunctionSource(LFSHashing);
    CLIFunctionsRepository.PushCliFunctionSource(SetupCloudRunnerRepository);
    const program = new Command();
    program.version('0.0.1');
    const properties = Object.getOwnPropertyNames(Input);
    const actionYamlReader: ActionYamlReader = new ActionYamlReader();
    for (const element of properties) {
      program.option(`--${element} <${element}>`, actionYamlReader.GetActionYamlValue(element));
    }
    program.option(
      '-m, --mode <mode>',
      CLIFunctionsRepository.GetAllCliModes()
        .map((x) => `${x.key} (${x.description})`)
        .join(` | `),
    );
    program.option('--populateOverride <populateOverride>', 'should use override query to pull input false by default');
    program.option('--cachePushFrom <cachePushFrom>', 'cache push from source folder');
    program.option('--cachePushTo <cachePushTo>', 'cache push to caching folder');
    program.option('--artifactName <artifactName>', 'caching artifact name');
    program.parse(process.argv);
    CLI.options = program.opts();
    return CLI.cliMode;
  }

  static async RunCli(): Promise<void> {
    Input.githubInputEnabled = false;
    if (CLI.options['populateOverride'] === `true`) {
      await CloudRunnerQueryOverride.PopulateQueryOverrideInput();
    }
    CLI.logInput();
    const results = CLIFunctionsRepository.GetCliFunctions(CLI.options.mode);
    CloudRunnerLogger.log(`Entrypoint: ${results.key}`);
    CLI.options.versioning = 'None';
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
