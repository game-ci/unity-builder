import { parseArgv } from './parse-argv.ts';
import { Bootstrapper } from '../controller/bootstrapper.ts';

export class Kernel {
  public async run() {
    const cliOptions = parseArgv(Deno.args);

    const bootstrapper = new Bootstrapper(cliOptions);
    bootstrapper.run();
  }
}
