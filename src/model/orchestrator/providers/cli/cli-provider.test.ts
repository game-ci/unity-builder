import { EventEmitter } from 'events';
import { ProviderLoader } from '../provider-loader';

// Mock child_process
jest.mock('child_process', () => ({
  spawn: jest.fn(),
  exec: jest.fn(),
}));

// Mock @actions/core to prevent GitHub Actions API calls
jest.mock('@actions/core', () => ({
  info: jest.fn(),
  warning: jest.fn(),
  error: jest.fn(),
  setOutput: jest.fn(),
  getInput: jest.fn(() => ''),
}));

// Mock provider-git-manager (required by provider-loader)
jest.mock('../provider-git-manager');

import { spawn } from 'child_process';
import CliProvider from './cli-provider';

const mockSpawn = spawn as jest.MockedFunction<typeof spawn>;

/**
 * Creates a mock child process with stdin, stdout, stderr as EventEmitters.
 */
function createMockChildProcess() {
  const child = new EventEmitter() as any;
  child.stdin = { write: jest.fn(), end: jest.fn() };
  child.stdout = new EventEmitter();
  child.stderr = new EventEmitter();
  child.kill = jest.fn();

  return child;
}

describe('CliProvider', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('constructor', () => {
    it('validates that executable path is non-empty', () => {
      expect(() => new CliProvider('', {} as any)).toThrow('executablePath must be a non-empty string');
    });

    it('validates that executable path is not just whitespace', () => {
      expect(() => new CliProvider('   ', {} as any)).toThrow('executablePath must be a non-empty string');
    });

    it('accepts a valid executable path', () => {
      const provider = new CliProvider('/usr/bin/my-provider', {} as any);
      expect(provider).toBeDefined();
    });
  });

  describe('request serialization', () => {
    it('sends JSON request to stdin with correct command and params', async () => {
      const child = createMockChildProcess();
      mockSpawn.mockReturnValue(child);

      const provider = new CliProvider('/path/to/exe', {} as any);
      const promise = provider.listResources();

      // Simulate successful response
      child.stdout.emit('data', Buffer.from(JSON.stringify({ success: true, result: [] }) + '\n'));
      child.emit('close', 0);

      await promise;

      expect(child.stdin.write).toHaveBeenCalledTimes(1);
      const writtenData = child.stdin.write.mock.calls[0][0];
      const parsed = JSON.parse(writtenData);
      expect(parsed.command).toBe('list-resources');
      expect(parsed.params).toEqual({});
      expect(child.stdin.end).toHaveBeenCalled();
    });

    it('serializes setupWorkflow params correctly', async () => {
      const child = createMockChildProcess();
      mockSpawn.mockReturnValue(child);

      const provider = new CliProvider('/path/to/exe', {} as any);
      const promise = provider.setupWorkflow('guid-123', { editorVersion: '2022.3' } as any, 'main', []);

      child.stdout.emit('data', Buffer.from(JSON.stringify({ success: true, result: {} }) + '\n'));
      child.emit('close', 0);

      await promise;

      const writtenData = child.stdin.write.mock.calls[0][0];
      const parsed = JSON.parse(writtenData);
      expect(parsed.command).toBe('setup-workflow');
      expect(parsed.params.buildGuid).toBe('guid-123');
      expect(parsed.params.branchName).toBe('main');
    });
  });

  describe('response parsing', () => {
    it('resolves on successful JSON response', async () => {
      const child = createMockChildProcess();
      mockSpawn.mockReturnValue(child);

      const provider = new CliProvider('/path/to/exe', {} as any);
      const promise = provider.listResources();

      const resources = [{ Name: 'resource-1' }, { Name: 'resource-2' }];
      child.stdout.emit('data', Buffer.from(JSON.stringify({ success: true, result: resources }) + '\n'));
      child.emit('close', 0);

      const result = await promise;
      expect(result).toEqual(resources);
    });

    it('rejects on error JSON response', async () => {
      const child = createMockChildProcess();
      mockSpawn.mockReturnValue(child);

      const provider = new CliProvider('/path/to/exe', {} as any);
      const promise = provider.garbageCollect('', false, 30, false, false);

      child.stdout.emit('data', Buffer.from(JSON.stringify({ success: false, error: 'something went wrong' }) + '\n'));
      child.emit('close', 1);

      await expect(promise).rejects.toThrow('something went wrong');
    });

    it('rejects when process exits with non-zero code and no JSON response', async () => {
      const child = createMockChildProcess();
      mockSpawn.mockReturnValue(child);

      const provider = new CliProvider('/path/to/exe', {} as any);
      const promise = provider.listWorkflow();

      child.stderr.emit('data', Buffer.from('segfault\n'));
      child.emit('close', 139);

      await expect(promise).rejects.toThrow('exited with code 139');
    });

    it('resolves when process exits with code 0 and no JSON response', async () => {
      const child = createMockChildProcess();
      mockSpawn.mockReturnValue(child);

      const provider = new CliProvider('/path/to/exe', {} as any);
      const promise = provider.listResources();

      child.stdout.emit('data', Buffer.from('some plain text output\n'));
      child.emit('close', 0);

      const result = await promise;
      // listResources falls back to empty array when result is missing
      expect(result).toEqual([]);
    });

    it('rejects on spawn error', async () => {
      const child = createMockChildProcess();
      mockSpawn.mockReturnValue(child);

      const provider = new CliProvider('/nonexistent/path', {} as any);
      const promise = provider.listResources();

      child.emit('error', new Error('ENOENT'));

      await expect(promise).rejects.toThrow('failed to spawn executable');
    });
  });

  describe('runTaskInWorkflow', () => {
    it('forwards non-JSON stdout lines as build output and returns final response', async () => {
      const child = createMockChildProcess();
      mockSpawn.mockReturnValue(child);

      const provider = new CliProvider('/path/to/exe', {} as any);
      const promise = provider.runTaskInWorkflow('guid', 'image', 'cmd', '/mnt', '/work', [], []);

      // Simulate build output followed by JSON response
      child.stdout.emit('data', Buffer.from('Building project...\nCompiling scripts...\n'));
      child.stdout.emit('data', Buffer.from(JSON.stringify({ success: true, output: 'Build succeeded' }) + '\n'));
      child.emit('close', 0);

      const result = await promise;
      expect(result).toBe('Build succeeded');
    });

    it('rejects on run-task failure', async () => {
      const child = createMockChildProcess();
      mockSpawn.mockReturnValue(child);

      const provider = new CliProvider('/path/to/exe', {} as any);
      const promise = provider.runTaskInWorkflow('guid', 'image', 'cmd', '/mnt', '/work', [], []);

      child.stdout.emit(
        'data',
        Buffer.from(JSON.stringify({ success: false, error: 'Build failed: compilation errors' }) + '\n'),
      );
      child.emit('close', 1);

      await expect(promise).rejects.toThrow('Build failed: compilation errors');
    });

    it('returns collected output lines when no JSON response and exit code 0', async () => {
      const child = createMockChildProcess();
      mockSpawn.mockReturnValue(child);

      const provider = new CliProvider('/path/to/exe', {} as any);
      const promise = provider.runTaskInWorkflow('guid', 'image', 'cmd', '/mnt', '/work', [], []);

      child.stdout.emit('data', Buffer.from('line 1\nline 2\n'));
      child.emit('close', 0);

      const result = await promise;
      expect(result).toBe('line 1\nline 2');
    });
  });

  describe('cleanupWorkflow', () => {
    it('sends cleanup-workflow command and returns result', async () => {
      const child = createMockChildProcess();
      mockSpawn.mockReturnValue(child);

      const provider = new CliProvider('/path/to/exe', {} as any);
      const promise = provider.cleanupWorkflow({ editorVersion: '2022.3' } as any, 'main', []);

      child.stdout.emit('data', Buffer.from(JSON.stringify({ success: true, result: 'cleaned' }) + '\n'));
      child.emit('close', 0);

      const result = await promise;
      expect(result).toBe('cleaned');

      const parsed = JSON.parse(child.stdin.write.mock.calls[0][0]);
      expect(parsed.command).toBe('cleanup-workflow');
      expect(parsed.params.branchName).toBe('main');
    });
  });

  describe('garbageCollect', () => {
    it('sends garbage-collect command with correct params', async () => {
      const child = createMockChildProcess();
      mockSpawn.mockReturnValue(child);

      const provider = new CliProvider('/path/to/exe', {} as any);
      const promise = provider.garbageCollect('filter*', true, 30, false, true);

      child.stdout.emit('data', Buffer.from(JSON.stringify({ success: true, output: '3 items removed' }) + '\n'));
      child.emit('close', 0);

      const result = await promise;
      expect(result).toBe('3 items removed');

      const parsed = JSON.parse(child.stdin.write.mock.calls[0][0]);
      expect(parsed.command).toBe('garbage-collect');
      expect(parsed.params.filter).toBe('filter*');
      expect(parsed.params.previewOnly).toBe(true);
      expect(parsed.params.olderThan).toBe(30);
      expect(parsed.params.baseDependencies).toBe(true);
    });

    it('returns empty string when response has no output', async () => {
      const child = createMockChildProcess();
      mockSpawn.mockReturnValue(child);

      const provider = new CliProvider('/path/to/exe', {} as any);
      const promise = provider.garbageCollect('', false, 7, false, false);

      child.stdout.emit('data', Buffer.from(JSON.stringify({ success: true }) + '\n'));
      child.emit('close', 0);

      const result = await promise;
      expect(result).toBe('');
    });
  });

  describe('listWorkflow', () => {
    it('returns workflow list from response', async () => {
      const child = createMockChildProcess();
      mockSpawn.mockReturnValue(child);

      const provider = new CliProvider('/path/to/exe', {} as any);
      const promise = provider.listWorkflow();

      const workflows = [{ Name: 'wf-1' }];
      child.stdout.emit('data', Buffer.from(JSON.stringify({ success: true, result: workflows }) + '\n'));
      child.emit('close', 0);

      const result = await promise;
      expect(result).toEqual(workflows);
    });

    it('returns empty array when result is missing', async () => {
      const child = createMockChildProcess();
      mockSpawn.mockReturnValue(child);

      const provider = new CliProvider('/path/to/exe', {} as any);
      const promise = provider.listWorkflow();

      child.stdout.emit('data', Buffer.from(JSON.stringify({ success: true }) + '\n'));
      child.emit('close', 0);

      const result = await promise;
      expect(result).toEqual([]);
    });
  });

  describe('watchWorkflow', () => {
    it('forwards streaming output and resolves on success', async () => {
      const child = createMockChildProcess();
      mockSpawn.mockReturnValue(child);

      const provider = new CliProvider('/path/to/exe', {} as any);
      const promise = provider.watchWorkflow();

      child.stdout.emit('data', Buffer.from('watching...\nstatus: running\n'));
      child.stdout.emit('data', Buffer.from(JSON.stringify({ success: true, output: 'completed' }) + '\n'));
      child.emit('close', 0);

      const result = await promise;
      expect(result).toBe('completed');

      const parsed = JSON.parse(child.stdin.write.mock.calls[0][0]);
      expect(parsed.command).toBe('watch-workflow');
    });

    it('rejects on watch-workflow failure', async () => {
      const child = createMockChildProcess();
      mockSpawn.mockReturnValue(child);

      const provider = new CliProvider('/path/to/exe', {} as any);
      const promise = provider.watchWorkflow();

      child.stdout.emit('data', Buffer.from(JSON.stringify({ success: false, error: 'lost connection' }) + '\n'));
      child.emit('close', 1);

      await expect(promise).rejects.toThrow('lost connection');
    });

    it('rejects on spawn error', async () => {
      const child = createMockChildProcess();
      mockSpawn.mockReturnValue(child);

      const provider = new CliProvider('/path/to/exe', {} as any);
      const promise = provider.watchWorkflow();

      child.emit('error', new Error('ENOENT'));

      await expect(promise).rejects.toThrow('failed to spawn executable');
    });

    it('resolves with collected output when exit code 0 and no JSON', async () => {
      const child = createMockChildProcess();
      mockSpawn.mockReturnValue(child);

      const provider = new CliProvider('/path/to/exe', {} as any);
      const promise = provider.watchWorkflow();

      child.stdout.emit('data', Buffer.from('line A\nline B\n'));
      child.emit('close', 0);

      const result = await promise;
      expect(result).toBe('line A\nline B');
    });
  });

  describe('stderr forwarding', () => {
    it('forwards stderr lines to logger during execute', async () => {
      const child = createMockChildProcess();
      mockSpawn.mockReturnValue(child);

      const provider = new CliProvider('/path/to/exe', {} as any);
      const promise = provider.listResources();

      child.stderr.emit('data', Buffer.from('warning: something\n'));
      child.stdout.emit('data', Buffer.from(JSON.stringify({ success: true, result: [] }) + '\n'));
      child.emit('close', 0);

      await promise;
      // stderr content included in error message if process fails
      // Here it succeeds, so we just verify no rejection
    });

    it('includes stderr in error message when process fails without JSON', async () => {
      const child = createMockChildProcess();
      mockSpawn.mockReturnValue(child);

      const provider = new CliProvider('/path/to/exe', {} as any);
      const promise = provider.listResources();

      child.stderr.emit('data', Buffer.from('fatal: segfault\n'));
      child.emit('close', 1);

      await expect(promise).rejects.toThrow('fatal: segfault');
    });
  });

  describe('timeout handling', () => {
    beforeEach(() => {
      jest.useFakeTimers();
    });

    afterEach(() => {
      jest.useRealTimers();
    });

    it('rejects and kills process when command times out', async () => {
      const child = createMockChildProcess();
      mockSpawn.mockReturnValue(child);

      const provider = new CliProvider('/path/to/exe', {} as any);
      const promise = provider.listResources();

      // Advance past the 300s default timeout
      jest.advanceTimersByTime(301_000);

      await expect(promise).rejects.toThrow('timed out');
      expect(child.kill).toHaveBeenCalledWith('SIGTERM');
    });
  });

  describe('available providers list', () => {
    it('includes cli in the available providers', () => {
      const providers = ProviderLoader.getAvailableProviders();
      expect(providers).toContain('cli');
    });
  });
});
