import { assert, assertFalse, assertEquals, assertThrows } from './deps-test.ts';
import { existsSync } from 'https://deno.land/std/fs/mod.ts';
import { Foo } from './foo.ts';

// Todo - Remove this test after we have some coverage
assertEquals(Foo.bar(), 'bar');

// Todo - Enable this test, once node_modules are completely phased out.
// Deno.test('package.json does not exist', async () => {
//   assertFalse(existsSync(`${Deno.cwd()}/package.json`));
// });

Deno.test('package-lock.json does not exist', async () => {
  assertFalse(existsSync(`${Deno.cwd()}/package-lock.json`));
});

// Todo - Enable this test, once node_modules are completely phased out.
// Deno.test('yarn.lock does not exist', async () => {
//   assertFalse(existsSync(`${Deno.cwd()}/yarn.lock`));
// });

// Todo - Enable this test, once node_modules are completely phased out.
// Deno.test('node_modules does not exist', async () => {
//   assertFalse(existsSync(`${Deno.cwd()}/node_modules`));
// });
