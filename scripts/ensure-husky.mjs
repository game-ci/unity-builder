#!/usr/bin/env node
// Self-heals husky git hooks before local dev workflows.
//
// Why this exists: Yarn 4 skips lifecycle scripts (`prepare`, `postinstall`) on
// no-op installs, so `yarn install --immutable` does NOT reinstall hooks once
// `.husky/_/` has been wiped. `.husky/_/` is gitignored, so it is also missing
// in fresh worktrees and after `git clean -fdx`. Without this guard, commits
// silently skip the pre-commit hook (git treats a missing hook file as "no hook").
//
// Behaviour: ~20 ms no-op when hooks are already installed. Skipped in CI and
// when HUSKY=0. Fails loudly (non-zero exit) on real install errors so the
// caller stops before commits are made without hooks.

import { execSync } from 'node:child_process';
import { existsSync } from 'node:fs';

if (process.env.CI || process.env.HUSKY === '0') process.exit(0);

const expectedHooksPath = '.husky/_';
const sentinelHook = '.husky/_/pre-commit';
// husky 9.1+ ships bin.js; husky 9.0 ships bin.mjs. Try both.
const huskyBin = ['node_modules/husky/bin.js', 'node_modules/husky/bin.mjs'].find(existsSync);

let configuredHooksPath = '';
try {
  configuredHooksPath = execSync('git config --get core.hooksPath', {
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'ignore'],
  }).trim();
} catch {
  // not a git repo or config unset — fall through and try to install
}

if (configuredHooksPath === expectedHooksPath && existsSync(sentinelHook)) {
  process.exit(0);
}

if (!huskyBin) {
  // husky not installed yet (yarn install hasn't run) — silent no-op
  process.exit(0);
}

console.log('· installing git hooks (husky self-heal)…');
try {
  execSync(`node ${huskyBin}`, { stdio: 'inherit' });
} catch (error) {
  const message = error instanceof Error ? error.message : String(error);
  console.error(
    `\n❌ husky install failed: ${message}\n\n` +
      `   git pre-commit hooks are NOT installed; commits will skip lint/format/tests.\n` +
      `   Fix the underlying error above, then run \`yarn setup:hooks\` to retry.\n` +
      `   To bypass this guard temporarily (NOT recommended): HUSKY=0 yarn <cmd>.\n`,
  );
  process.exit(1);
}
