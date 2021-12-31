import { Command } from 'commander-ts';
import { BuildParameters, CloudRunner, ImageTag, Input } from '..';
import * as core from '@actions/core';
import { RemoteClient } from './remote-client';
import { ActionYamlReader } from '../input-readers/action-yaml';
import CloudRunnerLogger from '../cloud-runner/services/cloud-runner-logger';
export class CLI {
  static async RunCli(options: any): Promise<void> {
    const container = new Array();
    container.push(
      {
        key: `remote-cli`,
        asyncFunc: RemoteClient.Run,
      },
      {
        key: `cli`,
        asyncFunc: async () => {
          options.versioning = 'None';
          Input.cliOptions = options;
          const buildParameter = await BuildParameters.create();
          const baseImage = new ImageTag(buildParameter);
          return await CloudRunner.run(buildParameter, baseImage.toString());
        },
      },
    );
    const results = container.filter((x) => x.key === options.mode);

    if (results.length === 0) {
      throw new Error('no CLI mode found');
    }

    CloudRunnerLogger.log(`Entrypoint: ${results[0]}`);

    return await results[0].asyncFunc();
  }
  static isCliMode(options: any) {
    return options.mode !== undefined && options.mode !== '';
  }

  public static SetupCli() {
    Input.githubEnabled = false;
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
    program.option('-m, --mode <mode>', 'cli or default');
    program.parse(process.argv);

    return program.opts();
  }
}
