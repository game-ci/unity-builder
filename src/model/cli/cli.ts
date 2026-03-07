import { Command } from 'commander-ts';
import { BuildParameters, Orchestrator, ImageTag, Input } from '..';
import * as core from '@actions/core';
import { ActionYamlReader } from '../input-readers/action-yaml';
import OrchestratorLogger from '../orchestrator/services/core/orchestrator-logger';
import OrchestratorQueryOverride from '../orchestrator/options/orchestrator-query-override';
import { CliFunction, CliFunctionsRepository } from './cli-functions-repository';
import { Caching } from '../orchestrator/remote-client/caching';
import { LfsHashing } from '../orchestrator/services/utility/lfs-hashing';
import { RemoteClient } from '../orchestrator/remote-client';
import OrchestratorOptionsReader from '../orchestrator/options/orchestrator-options-reader';
import GitHub from '../github';
import { OptionValues } from 'commander';
import { InputKey } from '../input';
import { SubmoduleProfileService } from '../orchestrator/services/submodule/submodule-profile-service';
import { LfsAgentService } from '../orchestrator/services/lfs/lfs-agent-service';

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
    CliFunctionsRepository.PushCliFunctionSource(RemoteClient);
    CliFunctionsRepository.PushCliFunctionSource(Caching);
    CliFunctionsRepository.PushCliFunctionSource(LfsHashing);
    const program = new Command();
    program.version('0.0.1');

    const properties = OrchestratorOptionsReader.GetProperties();
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
    GitHub.githubInputEnabled = false;
    if (Cli.options!['populateOverride'] === `true`) {
      await OrchestratorQueryOverride.PopulateQueryOverrideInput();
    }
    if (Cli.options!['logInput']) {
      Cli.logInput();
    }
    const results = CliFunctionsRepository.GetCliFunctions(Cli.options?.mode);
    OrchestratorLogger.log(`Entrypoint: ${results.key}`);
    Cli.options!.versioning = 'None';

    Orchestrator.buildParameters = await BuildParameters.create();
    Orchestrator.buildParameters.buildGuid = process.env.BUILD_GUID || ``;
    OrchestratorLogger.log(`Build Params:
      ${JSON.stringify(Orchestrator.buildParameters, undefined, 4)}
    `);
    Orchestrator.lockedWorkspace = process.env.LOCKED_WORKSPACE || ``;
    OrchestratorLogger.log(`Locked Workspace: ${Orchestrator.lockedWorkspace}`);
    await Orchestrator.setup(Orchestrator.buildParameters);

    return await results.target[results.propertyKey](Cli.options);
  }

  @CliFunction(`print-input`, `prints all input`)
  private static logInput() {
    core.info(`\n`);
    core.info(`INPUT:`);
    const properties = OrchestratorOptionsReader.GetProperties();
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

  @CliFunction(`cli-build`, `runs a orchestrator build`)
  public static async CLIBuild(): Promise<string> {
    const buildParameter = await BuildParameters.create();
    const baseImage = new ImageTag(buildParameter);

    return (await Orchestrator.run(buildParameter, baseImage.toString())).BuildResults;
  }

  @CliFunction(`async-workflow`, `runs a orchestrator build`)
  public static async asyncronousWorkflow(): Promise<string> {
    const buildParameter = await BuildParameters.create();
    const baseImage = new ImageTag(buildParameter);
    await Orchestrator.setup(buildParameter);

    return (await Orchestrator.run(buildParameter, baseImage.toString())).BuildResults;
  }

  @CliFunction(`checks-update`, `runs a orchestrator build`)
  public static async checksUpdate() {
    const buildParameter = await BuildParameters.create();

    await Orchestrator.setup(buildParameter);
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

    await Orchestrator.setup(buildParameter);

    return await Orchestrator.Provider.garbageCollect(``, false, 0, false, false);
  }

  @CliFunction(`list-resources`, `lists active resources`)
  public static async ListResources(): Promise<string[]> {
    const buildParameter = await BuildParameters.create();

    await Orchestrator.setup(buildParameter);
    const result = await Orchestrator.Provider.listResources();
    OrchestratorLogger.log(JSON.stringify(result, undefined, 4));

    return result.map((x) => x.Name);
  }

  @CliFunction(`list-worfklow`, `lists running workflows`)
  public static async ListWorfklow(): Promise<string[]> {
    const buildParameter = await BuildParameters.create();

    await Orchestrator.setup(buildParameter);

    return (await Orchestrator.Provider.listWorkflow()).map((x) => x.Name);
  }

  @CliFunction(`watch`, `follows logs of a running workflow`)
  public static async Watch(): Promise<string> {
    const buildParameter = await BuildParameters.create();

    await Orchestrator.setup(buildParameter);

    return await Orchestrator.Provider.watchWorkflow();
  }

  @CliFunction(`submodule-init`, `initializes submodules from a YAML profile`)
  public static async SubmoduleInit(): Promise<void> {
    const profilePath = Cli.options!['profilePath'];
    const variantPath = Cli.options!['variantPath'] || '';
    if (!profilePath) {
      throw new Error('--profilePath is required for submodule-init');
    }
    const plan = await SubmoduleProfileService.createInitPlan(profilePath, variantPath, process.cwd());
    await SubmoduleProfileService.execute(plan, process.cwd());
  }

  @CliFunction(`lfs-agent-configure`, `configures a custom LFS transfer agent`)
  public static async LfsAgentConfigure(): Promise<void> {
    const agentPath = Cli.options!['agentPath'];
    if (!agentPath) {
      throw new Error('--agentPath is required for lfs-agent-configure');
    }
    const agentArgs = Cli.options!['agentArgs'] || '';
    const storagePaths = (Cli.options!['storagePaths'] || '').split(';').filter(Boolean);
    await LfsAgentService.configure(agentPath, agentArgs, storagePaths, process.cwd());
  }
}
