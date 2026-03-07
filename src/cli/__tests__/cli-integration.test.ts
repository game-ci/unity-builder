import { execFile } from 'node:child_process';
import path from 'node:path';

/**
 * Integration tests that spawn the CLI as a child process and verify
 * exit codes and output. Uses node with --require ts-node/register to
 * run the TypeScript entry point directly so no build step is required.
 */

const CLI_ENTRY = path.resolve(__dirname, '..', '..', 'cli.ts');

function runCli(cliArguments: string[]): Promise<{ code: number | null; stdout: string; stderr: string }> {
  return new Promise((resolve) => {
    execFile(
      process.execPath,
      ['--require', 'ts-node/register/transpile-only', CLI_ENTRY, ...cliArguments],
      { timeout: 30_000, cwd: path.resolve(__dirname, '..', '..', '..') },
      (error, stdout, stderr) => {
        resolve({
          code: error ? error.code ?? 1 : 0,
          stdout: stdout.toString(),
          stderr: stderr.toString(),
        });
      },
    );
  });
}

// Integration tests spawn child processes which need more time than the default 5s
jest.setTimeout(30_000);

describe('CLI integration', () => {
  it('exits 0 and shows all commands for --help', async () => {
    const result = await runCli(['--help']);

    expect(result.code).toStrictEqual(0);
    expect(result.stdout).toContain('game-ci');
    expect(result.stdout).toContain('build');
    expect(result.stdout).toContain('activate');
    expect(result.stdout).toContain('orchestrate');
    expect(result.stdout).toContain('cache');
    expect(result.stdout).toContain('status');
    expect(result.stdout).toContain('version');
    expect(result.stdout).toContain('update');
  });

  it('exits 0 and shows version info for version command', async () => {
    const result = await runCli(['version']);

    expect(result.code).toStrictEqual(0);
    expect(result.stdout).toContain('unity-builder');
  });

  it('exits 0 and shows build flags for build --help', async () => {
    const result = await runCli(['build', '--help']);

    expect(result.code).toStrictEqual(0);
    expect(result.stdout).toContain('--target-platform');
    expect(result.stdout).toContain('--unity-version');
    expect(result.stdout).toContain('--project-path');
    expect(result.stdout).toContain('--build-name');
    expect(result.stdout).toContain('--builds-path');
    expect(result.stdout).toContain('--build-method');
    expect(result.stdout).toContain('--custom-parameters');
    expect(result.stdout).toContain('--provider-strategy');
  });

  it('exits non-zero for an unknown command', async () => {
    const result = await runCli(['nonexistent']);

    expect(result.code).not.toStrictEqual(0);
  });

  it('exits non-zero when no command is provided', async () => {
    const result = await runCli([]);

    expect(result.code).not.toStrictEqual(0);
  });

  it('exits 0 for orchestrate --help', async () => {
    const result = await runCli(['orchestrate', '--help']);

    expect(result.code).toStrictEqual(0);
    expect(result.stdout).toContain('--target-platform');
    expect(result.stdout).toContain('--provider-strategy');
  });

  it('exits 0 for activate --help', async () => {
    const result = await runCli(['activate', '--help']);

    expect(result.code).toStrictEqual(0);
    expect(result.stdout).toContain('activate');
  });

  it('exits 0 for cache --help', async () => {
    const result = await runCli(['cache', '--help']);

    expect(result.code).toStrictEqual(0);
    expect(result.stdout).toContain('cache');
  });

  it('exits 0 for update --help', async () => {
    const result = await runCli(['update', '--help']);

    expect(result.code).toStrictEqual(0);
    expect(result.stdout).toContain('update');
    expect(result.stdout).toContain('--force');
    expect(result.stdout).toContain('--version');
  });
});
