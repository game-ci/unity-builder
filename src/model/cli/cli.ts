import { Command } from 'commander-ts';
import { BuildParameters, CloudRunner, ImageTag, Input } from '..';
import * as core from '@actions/core';
import { RemoteClient } from './remote-client';

export class CLI {
  static async RunCli(options: any) {
    core.info(`Entrypoint: ${options.mode}`);

    if (options.mode === 'remote-cli') {
      await RemoteClient.Run(options);
    } else {
      options.versioning = 'None';
      Input.cliOptions = options;
      const buildParameter = await BuildParameters.create();
      const baseImage = new ImageTag(buildParameter);
      await CloudRunner.run(buildParameter, baseImage.toString());
    }
  }
  static isCliMode(options: any) {
    switch (options.mode) {
      case 'cli':
      case 'remote-cli':
        return true;
      default:
        return false;
    }
  }
  public static SetupCli() {
    Input.githubEnabled = false;
    const program = new Command();
    program.version('0.0.1');
    const properties = Object.getOwnPropertyNames(Input);
    core.info(`\n`);
    core.info(`INPUT:`);
    for (const element of properties) {
      // TODO pull description from action.yml
      program.option(`--${element} <${element}>`, 'default description');
      if (Input[element] !== undefined && Input[element] !== '') {
        core.info(`${element} ${Input[element]}`);
      }
    }
    core.info(`\n`);
    program.option('-m, --mode <mode>', 'cli or default');
    program.parse(process.argv);

    return program.opts();
  }
}
