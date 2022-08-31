import { open } from 'https://deno.land/x/opener@v1.0.1/mod.ts';

await open(`file://${Deno.cwd()}/.coverage/report/index.html`);
