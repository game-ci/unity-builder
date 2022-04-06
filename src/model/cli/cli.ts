import { Command } from 'commander-ts';
import { BuildParameters, CloudRunner, ImageTag, Input } from '..';
import * as core from '@actions/core';
import { ActionYamlReader } from '../input-readers/action-yaml';
import CloudRunnerLogger from '../cloud-runner/services/cloud-runner-logger';
import { CliFunction, GetAllCliModes, GetCliFunctions } from './cli-decorator';
import { RemoteClientLogger } from './remote-client/remote-client-services/remote-client-logger';
import { SetupCloudRunnerRepository } from './remote-client/setup-cloud-runner-repository';
import * as SDK from 'aws-sdk';
import { Caching } from './remote-client/remote-client-services/caching';
import CloudRunnerQueryOverride from '../cloud-runner/services/cloud-runner-query-override';

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
    const program = new Command();
    program.version('0.0.1');
    const properties = Object.getOwnPropertyNames(Input);
    const actionYamlReader: ActionYamlReader = new ActionYamlReader();
    for (const element of properties) {
      program.option(`--${element} <${element}>`, actionYamlReader.GetActionYamlValue(element));
    }
    program.option(
      '-m, --mode <mode>',
      GetAllCliModes()
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
    const results = GetCliFunctions(CLI.options.mode);
    CloudRunnerLogger.log(`Entrypoint: ${results.key}`);
    CLI.options.versioning = 'None';
    return await results.target[results.propertyKey]();
  }

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

  @CliFunction(`remote-cli`, `sets up a repository, usually before a game-ci build`)
  static async runRemoteClientJob() {
    const buildParameter = JSON.parse(process.env.BUILD_PARAMETERS || '{}');
    RemoteClientLogger.log(`Build Params:
      ${JSON.stringify(buildParameter, undefined, 4)}
    `);
    CloudRunner.buildParameters = buildParameter;
    await SetupCloudRunnerRepository.run();
  }

  @CliFunction(`cache-push`, `push to cache`)
  static async cachePush() {
    try {
      const buildParameter = JSON.parse(process.env.BUILD_PARAMETERS || '{}');
      RemoteClientLogger.log(`Build Params:
        ${JSON.stringify(buildParameter, undefined, 4)}
      `);
      CloudRunner.buildParameters = buildParameter;
      CloudRunnerLogger.log(
        `${CLI.options['cachePushFrom']} ${CLI.options['cachePushTo']} ${CLI.options['artifactName']}`,
      );
      await Caching.PushToCache(CLI.options['cachePushTo'], CLI.options['cachePushFrom'], CLI.options['artifactName']);
    } catch (error: any) {
      CloudRunnerLogger.log(`${error}`);
    }
  }

  @CliFunction(`cache-pull`, `pull from cache`)
  static async cachePull() {}

  @CliFunction(`garbage-collect-aws`, `garbage collect aws`)
  static async garbageCollectAws() {
    process.env.AWS_REGION = Input.region;
    const CF = new SDK.CloudFormation();

    const stacks = await CF.listStacks().promise();
    CloudRunnerLogger.log(JSON.stringify(stacks, undefined, 4));
  }
}
