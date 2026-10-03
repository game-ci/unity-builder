import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import * as core from '@actions/core';
import * as exec from '@actions/exec';
import { downloadCli } from './download-cli';
import { resolveProjectPath } from './resolve-project-path';
import { run } from './index';

vi.mock('@actions/core');
vi.mock('@actions/exec');
vi.mock('./download-cli');
vi.mock('./resolve-project-path');

describe('CLI build outputs', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    vi.mocked(core.getInput).mockImplementation((name) =>
      name === 'targetPlatform' ? 'WSAPlayer' : '',
    );
    vi.mocked(downloadCli).mockResolvedValue('game-ci');
    vi.mocked(resolveProjectPath).mockReturnValue('');
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  /** Simulate CLI stdout records and the subprocess exit code. */
  function cliReports(lines: string[], exitCode = 0) {
    vi.mocked(exec.exec).mockImplementation(async (_command, _args, options) => {
      for (const line of lines) options?.listeners?.stdout?.(Buffer.from(`${line}\n`));
      return exitCode;
    });
  }

  it('publishes the version outputs reported by CLI v0.1.71', async () => {
    cliReports([
      '(mock) Output "buildVersion" is set to "1.166.0"',
      '(mock) Output "androidVersionCode" is set to "1166000"',
      '[INFO] Build done.',
    ]);

    await run();

    expect(core.setOutput).toHaveBeenCalledWith('buildVersion', '1.166.0');
    expect(core.setOutput).toHaveBeenCalledWith('androidVersionCode', '1166000');
    expect(core.setOutput).toHaveBeenCalledWith('engineExitCode', 0);
    expect(core.setFailed).not.toHaveBeenCalled();
  });

  it('ignores unrelated logs, unknown outputs and malformed records', async () => {
    cliReports([
      'Found flag "buildVersion" with value "1.166.0".',
      '(mock) Output "engineExitCode" is set to "99"',
      '(mock) Output "other" is set to "unexpected"',
      '(mock) Output "buildVersion" is set to ""',
      '(mock) Output "buildVersion" is set to "1.0.0" trailing text',
      'prefix (mock) Output "buildVersion" is set to "1.0.0"',
      '(mock) Output "buildVersion" is set to "1.0.0\nother=value"',
    ]);

    await run();

    expect(core.setOutput).toHaveBeenCalledExactlyOnceWith('engineExitCode', 0);
  });

  it('preserves custom versions and uses the last reported value', async () => {
    cliReports([
      '(mock) Output "buildVersion" is set to "1.0.0"',
      '(mock) Output "buildVersion" is set to "1.166.0-rc.1+abc123"',
    ]);

    await run();

    expect(core.setOutput).toHaveBeenCalledWith('buildVersion', '1.166.0-rc.1+abc123');
    expect(core.setOutput).toHaveBeenCalledTimes(2);
  });

  it('does not replace outputs written directly by a newer CLI', async () => {
    cliReports(['[INFO] Build done.']);

    await run();

    expect(core.setOutput).toHaveBeenCalledExactlyOnceWith('engineExitCode', 0);
  });

  it('preserves a failed build exit code without publishing success outputs', async () => {
    cliReports(['(mock) Output "buildVersion" is set to "1.166.0"'], 42);

    await run();

    expect(core.setOutput).toHaveBeenCalledExactlyOnceWith('engineExitCode', 42);
    expect(core.setFailed).toHaveBeenCalledWith('Build failed with exit code 42');
  });

  it('reports a CLI launch failure', async () => {
    vi.mocked(exec.exec).mockRejectedValue(new Error('Unable to start CLI'));

    await run();

    expect(core.setOutput).not.toHaveBeenCalled();
    expect(core.setFailed).toHaveBeenCalledWith('Unable to start CLI');
  });

  it.each(['\n', '\r\n', ''])(
    'writes real GitHub outputs with final line ending %j',
    async (lineEnding) => {
      const actualExec = await vi.importActual<typeof exec>('@actions/exec');
      const actualCore = await vi.importActual<typeof core>('@actions/core');
      const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'unity-builder-output-'));
      const outputFile = path.join(directory, 'outputs');
      fs.writeFileSync(outputFile, '');
      vi.stubEnv('GITHUB_OUTPUT', outputFile);
      vi.mocked(core.setOutput).mockImplementation(actualCore.setOutput);
      vi.mocked(exec.exec).mockImplementation(async (_command, _args, options) => {
        return actualExec.exec(
          `"${process.execPath}"`,
          [
            '-e',
            `
          process.stdout.write('(mock) Output "buildVer');
          setTimeout(() => {
            process.stdout.write('sion" is set to "1.166.0"\\r\\n');
            process.stdout.write(${JSON.stringify('(mock) Output "androidVersionCode" is set to "1166000"' + lineEnding)});
          }, 10);
        `,
          ],
          { ...options, silent: true },
        );
      });

      try {
        await run();

        expect(core.setFailed).not.toHaveBeenCalled();
        const output = fs.readFileSync(outputFile, 'utf8');
        expect(output).toMatch(/buildVersion<<[^\r\n]+\r?\n1\.166\.0\r?\n/);
        expect(output).toMatch(/androidVersionCode<<[^\r\n]+\r?\n1166000\r?\n/);
      } finally {
        fs.unlinkSync(outputFile);
        fs.rmdirSync(directory);
      }
    },
  );
});
