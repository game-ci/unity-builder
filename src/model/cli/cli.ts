import { Command } from 'commander-ts';
import { BuildParameters, CloudRunner, ImageTag, Input } from '..';
import * as core from '@actions/core';
import { ActionYamlReader } from '../input-readers/action-yaml';
import CloudRunnerLogger from '../cloud-runner/services/cloud-runner-logger';
import CloudRunnerQueryOverride from '../cloud-runner/services/cloud-runner-query-override';
import { CliFunction, CliFunctionsRepository } from './cli-functions-repository';
import { Caching } from '../cloud-runner/remote-client/caching';
import { LfsHashing } from '../cloud-runner/services/lfs-hashing';
import { RemoteClient } from '../cloud-runner/remote-client';
import CloudRunnerOptionsReader from '../cloud-runner/services/cloud-runner-options-reader';
import GitHub from '../github';
import { TaskParameterSerializer } from '../cloud-runner/services/task-parameter-serializer';
import { CloudRunnerFolders } from '../cloud-runner/services/cloud-runner-folders';
import { CloudRunnerSystem } from '../cloud-runner/services/cloud-runner-system';

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
    CliFunctionsRepository.PushCliFunctionSource(RemoteClient);
    CliFunctionsRepository.PushCliFunctionSource(Caching);
    CliFunctionsRepository.PushCliFunctionSource(LfsHashing);
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

    return Cli.isCliMode || process.env.GAMECI_CLI;
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
    CloudRunner.lockedWorkspace = process.env.LOCKED_WORKSPACE;

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

  @CliFunction(`cli-build`, `runs a cloud runner build`)
  public static async CLIBuild(): Promise<string> {
    const buildParameter = await BuildParameters.create();
    const baseImage = new ImageTag(buildParameter);

    return await CloudRunner.run(buildParameter, baseImage.toString());
  }

  @CliFunction(`async-workflow`, `runs a cloud runner build`)
  public static async asyncronousWorkflow(): Promise<string> {
    const buildParameter = await BuildParameters.create();
    const baseImage = new ImageTag(buildParameter);
    await CloudRunner.setup(buildParameter);

    return await CloudRunner.run(buildParameter, baseImage.toString());
  }

  @CliFunction(`checks-update`, `runs a cloud runner build`)
  public static async checksUpdate() {
    const buildParameter = await BuildParameters.create();

    await CloudRunner.setup(buildParameter);
    const input = JSON.parse(process.env.CHECKS_UPDATE || ``);
    core.info(`Checks Update ${process.env.CHECKS_UPDATE}`);
    if (input.mode === `create`) {
      throw new Error(`Not supported: only use update`);
    } else if (input.mode === `update`) {
      await GitHub.updateGitHubCheckRequest(input.data);
    }
  }

  @CliFunction(`garbage-collect`, `runs garbage collection`)
  public static async GarbageCollect(): Promise<string> {
    const buildParameter = await BuildParameters.create();

    await CloudRunner.setup(buildParameter);

    return await CloudRunner.Provider.garbageCollect(``, false, 0, false, false);
  }

  @CliFunction(`list-resources`, `lists active resources`)
  public static async ListResources(): Promise<string[]> {
    const buildParameter = await BuildParameters.create();

    await CloudRunner.setup(buildParameter);
    const result = await CloudRunner.Provider.listResources();
    CloudRunnerLogger.log(JSON.stringify(result, undefined, 4));

    return result.map((x) => x.Name);
  }

  @CliFunction(`list-worfklow`, `lists running workflows`)
  public static async ListWorfklow(): Promise<string[]> {
    const buildParameter = await BuildParameters.create();

    await CloudRunner.setup(buildParameter);

    return (await CloudRunner.Provider.listWorkflow()).map((x) => x.Name);
  }

  @CliFunction(`watch`, `follows logs of a running workflow`)
  public static async Watch(): Promise<string> {
    const buildParameter = await BuildParameters.create();

    await CloudRunner.setup(buildParameter);

    return await CloudRunner.Provider.watchWorkflow();
  }

  @CliFunction(`remote-cli-post-build`, `runs a cloud runner build`)
  public static async PostCLIBuild(): Promise<string> {
    core.info(`Running POST build tasks`);

    await Caching.PushToCache(
      CloudRunnerFolders.ToLinuxFolder(`${CloudRunnerFolders.cacheFolderForCacheKeyFull}/Library`),
      CloudRunnerFolders.ToLinuxFolder(CloudRunnerFolders.libraryFolderAbsolute),
      `lib-${CloudRunner.buildParameters.buildGuid}`,
    );

    await Caching.PushToCache(
      CloudRunnerFolders.ToLinuxFolder(`${CloudRunnerFolders.cacheFolderForCacheKeyFull}/build`),
      CloudRunnerFolders.ToLinuxFolder(CloudRunnerFolders.projectBuildFolderAbsolute),
      `build-${CloudRunner.buildParameters.buildGuid}`,
    );

    if (!CloudRunner.buildParameters.retainWorkspace) {
      await CloudRunnerSystem.Run(
        `rm -r ${CloudRunnerFolders.ToLinuxFolder(CloudRunnerFolders.uniqueCloudRunnerJobFolderAbsolute)}`,
      );
    }

    await RemoteClient.runCustomHookFiles(`after-build`);

    const parameters = await BuildParameters.create();
    CloudRunner.setup(parameters);
    if (parameters.constantGarbageCollection) {
      await CloudRunnerSystem.Run(
        `find /${CloudRunnerFolders.ToLinuxFolder(CloudRunnerFolders.buildVolumeFolder)}/ -name '*.*' -mmin +${
          parameters.garbageCollectionMaxAge * 60
        } -delete`,
      );
      await CloudRunnerSystem.Run(
        `find ${CloudRunnerFolders.ToLinuxFolder(CloudRunnerFolders.cacheFolderForAllFull)} -name '*.*' -mmin +${
          parameters.garbageCollectionMaxAge * 60
        } -delete`,
      );
    }

    return new Promise((result) => result(``));
  }
}
