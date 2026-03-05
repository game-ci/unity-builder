#!/usr/bin/env node

import yargs from 'yargs';
// eslint-disable-next-line import/no-unresolved
import { hideBin } from 'yargs/helpers';
import buildCommand from './cli/commands/build';
import activateCommand from './cli/commands/activate';
import orchestrateCommand from './cli/commands/orchestrate';
import cacheCommand from './cli/commands/cache';
import statusCommand from './cli/commands/status';
import versionCommand from './cli/commands/version';
import updateCommand from './cli/commands/update';
import * as core from '@actions/core';

const cli = yargs(hideBin(process.argv))
  .scriptName('game-ci')
  .usage('$0 <command> [options]')
  .command(buildCommand)
  .command(activateCommand)
  .command(orchestrateCommand)
  .command(cacheCommand)
  .command(statusCommand)
  .command(versionCommand)
  .command(updateCommand)
  .demandCommand(1, 'You must specify a command. Run game-ci --help for available commands.')
  .strict()
  .alias('h', 'help')
  .epilogue('For more information, visit https://game.ci')
  .wrap(Math.min(120, process.stdout.columns || 80));

async function main() {
  try {
    await cli.parse();
  } catch (error: any) {
    if (error.name !== 'YError') {
      core.error(`Error: ${error.message}`);
    }
  }
}

main();
