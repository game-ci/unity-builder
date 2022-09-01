import { CommandInterface } from '../command-interface.ts';
import { CommandBase } from '../command-base.ts';
import { YargsInstance, YargsArguments } from '../../dependencies.ts';

import { default as getHomeDir } from 'https://deno.land/x/dir@1.5.1/home_dir/mod.ts';
import { open } from 'https://deno.land/x/opener@v1.0.1/mod.ts';

export class OpenConfigFolderCommand extends CommandBase implements CommandInterface {
  public async execute(options: YargsArguments): Promise<boolean> {
    const cliStorageAbsolutePath = `${getHomeDir()}/.game-ci`;
    await open(`file://${cliStorageAbsolutePath}/`);

    return true;
  }

  public async configureOptions(yargs: YargsInstance): Promise<void> {}
}
