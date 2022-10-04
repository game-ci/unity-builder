import { Command } from 'commander-ts';
import { BuildParameters, CloudRunner, ImageTag, Input } from '..';
import * as core from '@actions/core';
import { ActionYamlReader } from '../input-readers/action-yaml';
import CloudRunnerLogger from '../cloud-runner/services/cloud-runner-logger';
import CloudRunnerQueryOverride from '../cloud-runner/services/cloud-runner-query-override';
import { CliFunction, CliFunctionsRepository } from './cli-functions-repository';
import { AwsCliCommands } from '../cloud-runner/providers/aws/commands/aws-cli-commands';
import { Caching } from '../cloud-runner/remote-client/caching';
import { LfsHashing } from '../cloud-runner/services/lfs-hashing';
import { RemoteClient } from '../cloud-runner/remote-client';
import CloudRunnerOptionsReader from '../cloud-runner/services/cloud-runner-options-reader';
import GitHub from '../github';
import { TaskParameterSerializer } from '../cloud-runner/services/task-parameter-serializer';
import { CloudRunnerFolders } from '../cloud-runner/services/cloud-runner-folders';

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

    const properties = CloudRunnerOptionsReader.GetProperties();
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
    program.option('--select <select>', 'select a particular resource');
    program.parse(process.argv);
    Cli.options = program.opts();

    return Cli.isCliMode;
  }

  static async RunCli(): Promise<void> {
    GitHub.githubInputEnabled = false;
    if (Cli.options['populateOverride'] === `true`) {
      await CloudRunnerQueryOverride.PopulateQueryOverrideInput();
    }
    if (Cli.options['logInput']) {
      Cli.logInput();
    }
    const results = CliFunctionsRepository.GetCliFunctions(Cli.options.mode);
    CloudRunnerLogger.log(`Entrypoint: ${results.key}`);
    Cli.options.versioning = 'None';

    const buildParameter = TaskParameterSerializer.readBuildParameterFromEnvironment();
    CloudRunnerLogger.log(`Build Params:
      ${JSON.stringify(buildParameter, undefined, 4)}
    `);
    CloudRunner.buildParameters = buildParameter;

    return await results.target[results.propertyKey](Cli.options);
  }

  @CliFunction(`print-input`, `prints all input`)
  private static logInput() {
    core.info(`\n`);
    core.info(`INPUT:`);
    const properties = CloudRunnerOptionsReader.GetProperties();
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

  @CliFunction(`remote-cli-post-build`, `runs a cloud runner build`)
  public static async PostCLIBuild(): Promise<string> {
    const buildParameter = await BuildParameters.create();

    /*
      # LIBRARY CACHE
      node ${builderPath} -m cache-push --cachePushFrom ${CloudRunnerFolders.ToLinuxFolder(
        CloudRunnerFolders.libraryFolderAbsolute,
      )} --artifactName lib-${guid} --cachePushTo ${CloudRunnerFolders.ToLinuxFolder(`${linuxCacheFolder}/Library`)}

      echo "game ci cloud runner push build to cache"

      # BUILD CACHE
      node ${builderPath} -m cache-push --cachePushFrom ${CloudRunnerFolders.ToLinuxFolder(
        CloudRunnerFolders.projectBuildFolderAbsolute,
      )} --artifactName build-${guid} --cachePushTo ${`${CloudRunnerFolders.ToLinuxFolder(`${linuxCacheFolder}/build`)}`}

      # RETAINED WORKSPACE CLEANUP
      ${BuildAutomationWorkflow.GetCleanupCommand(CloudRunnerFolders.projectPathAbsolute)}`;
    */

    core.info(`Running POST build tasks`);

    await Caching.PushToCache(
      CloudRunnerFolders.ToLinuxFolder(`${CloudRunnerFolders.cacheFolderFull}/Library`),
      CloudRunnerFolders.ToLinuxFolder(CloudRunnerFolders.libraryFolderAbsolute),
      `lib-${buildParameter.buildGuid}`,
    );

    await Caching.PushToCache(
      CloudRunnerFolders.ToLinuxFolder(`${CloudRunnerFolders.cacheFolderFull}/build`),
      CloudRunnerFolders.ToLinuxFolder(CloudRunnerFolders.projectBuildFolderAbsolute),
      `build-${buildParameter.buildGuid}`,
    );

    return new Promise((result) => result(``));
  }
}
