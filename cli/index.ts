/* eslint-disable no-console */
import { Bootstrapper } from './bootstrapper.ts';

(async () => {
  try {
    await new Bootstrapper().run(Deno.args);
  } catch (error) {
    console.error(error);
    Deno.exit(1);
  }
})();
