import { Command } from 'commander-ts';
import { BuildParameters, CloudRunner, ImageTag, Input } from '..';
import * as core from '@actions/core';
import { ActionYamlReader } from '../input-readers/action-yaml';
import CloudRunnerLogger from '../cloud-runner/services/cloud-runner-logger';
import { CliFunction, GetAllCliModes, GetCliFunctions } from './cli-decorator';
import { RemoteClientLogger } from './remote-client/remote-client-services/remote-client-logger';
import { CloudRunnerState } from '../cloud-runner/state/cloud-runner-state';
import { SetupCloudRunnerRepository } from './remote-client/setup-cloud-runner-repository';
export class CLI {
  static async RunCli(options: any): Promise<void> {
    Input.githubInputEnabled = false;

    const results = GetCliFunctions(options.mode);

    if (results === undefined || results.length === 0) {
      throw new Error('no CLI mode found');
    }

    CloudRunnerLogger.log(`Entrypoint: ${results.key}`);

    options.versioning = 'None';
    Input.cliOptions = options;
    return await results.target[results.propertyKey]();
  }
  static isCliMode(options: any) {
    return options.mode !== undefined && options.mode !== '';
  }

  public static SetupCli() {
    const program = new Command();
    program.version('0.0.1');
    const properties = Object.getOwnPropertyNames(Input);
    core.info(`\n`);
    core.info(`INPUT:`);
    const actionYamlReader: ActionYamlReader = new ActionYamlReader();
    for (const element of properties) {
      program.option(`--${element} <${element}>`, actionYamlReader.GetActionYamlValue(element));
      if (Input[element] !== undefined && Input[element] !== '' && typeof Input[element] !== `function`) {
        core.info(`${element} ${Input[element]}`);
      }
    }
    core.info(`\n`);
    program.option(
      '-m, --mode <mode>',
      GetAllCliModes()
        .map((x) => `${x.key} (${x.description})`)
        .join(` | `),
    );
    program.parse(process.argv);

    return program.opts();
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
    CloudRunnerState.setup(buildParameter);
    await SetupCloudRunnerRepository.run();
  }
}
