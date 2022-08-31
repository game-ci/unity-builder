import { open } from 'https://deno.land/x/opener/mod.ts';

await open(`file://${Deno.cwd()}/.coverage/report/index.html`);
