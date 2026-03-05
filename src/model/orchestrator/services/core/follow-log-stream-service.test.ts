import { FollowLogStreamService } from './follow-log-stream-service';
import * as core from '@actions/core';
import GitHub from '../../../github';

// Mock dependencies
jest.mock('../../../github', () => ({
  __esModule: true,
  default: {
    updateGitHubCheck: jest.fn(),
    githubInputEnabled: false,
  },
}));

jest.mock('@actions/core', () => ({
  warning: jest.fn(),
  setOutput: jest.fn(),
  setFailed: jest.fn(),
  error: jest.fn(),
  getInput: jest.fn().mockReturnValue(''),
}));

jest.mock('../../orchestrator', () => ({
  __esModule: true,
  default: {
    buildParameters: {
      logId: 'test-log-id-123',
    },
  },
}));

jest.mock('../../options/orchestrator-statics', () => ({
  OrchestratorStatics: {
    logPrefix: 'TEST',
  },
}));

jest.mock('./orchestrator-logger', () => ({
  __esModule: true,
  default: {
    log: jest.fn(),
  },
}));

describe('FollowLogStreamService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    FollowLogStreamService.Reset();
    FollowLogStreamService.errors = '';
  });

  describe('Reset', () => {
    it('resets DidReceiveEndOfTransmission to false', () => {
      FollowLogStreamService.DidReceiveEndOfTransmission = true;
      FollowLogStreamService.Reset();
      expect(FollowLogStreamService.DidReceiveEndOfTransmission).toBe(false);
    });
  });

  describe('handleIteration', () => {
    it('detects end of transmission marker', () => {
      const result = FollowLogStreamService.handleIteration('---test-log-id-123', true, false, '');
      expect(FollowLogStreamService.DidReceiveEndOfTransmission).toBe(true);
      expect(result.shouldReadLogs).toBe(false);
    });

    it('does not trigger end of transmission for non-matching log ID', () => {
      const result = FollowLogStreamService.handleIteration('---different-log-id', true, false, '');
      expect(FollowLogStreamService.DidReceiveEndOfTransmission).toBe(false);
      expect(result.shouldReadLogs).toBe(true);
    });

    it('detects Library rebuild message', () => {
      FollowLogStreamService.handleIteration(
        'Rebuilding Library because the asset database could not be found!',
        true,
        false,
        '',
      );
      expect(GitHub.updateGitHubCheck).toHaveBeenCalledWith('Library was not found, importing new Library', '');
      expect(core.warning).toHaveBeenCalledWith('LIBRARY NOT FOUND!');
      expect(core.setOutput).toHaveBeenCalledWith('library-found', 'false');
    });

    it('detects Build succeeded message', () => {
      FollowLogStreamService.handleIteration('Build succeeded', true, false, '');
      expect(GitHub.updateGitHubCheck).toHaveBeenCalledWith('Build succeeded', 'Build succeeded');
      expect(core.setOutput).toHaveBeenCalledWith('build-result', 'success');
    });

    it('detects Build fail message', () => {
      FollowLogStreamService.handleIteration('Build fail', true, false, '');
      expect(GitHub.updateGitHubCheck).toHaveBeenCalled();
      expect(core.setOutput).toHaveBeenCalledWith('build-result', 'failed');
      expect(core.setFailed).toHaveBeenCalledWith('unity build failed');
      expect(core.error).toHaveBeenCalledWith('BUILD FAILED!');
    });

    it('accumulates error messages with "error " pattern', () => {
      FollowLogStreamService.handleIteration('error CS0001: Something went wrong', true, false, '');
      expect(FollowLogStreamService.errors).toContain('error CS0001: Something went wrong');
      expect(core.error).toHaveBeenCalled();
    });

    it('accumulates error messages with "error: " pattern', () => {
      FollowLogStreamService.handleIteration('Fatal Error: Out of memory', true, false, '');
      expect(FollowLogStreamService.errors).toContain('Fatal Error: Out of memory');
    });

    it('accumulates "command failed: " messages', () => {
      FollowLogStreamService.handleIteration('command failed: git pull', true, false, '');
      expect(FollowLogStreamService.errors).toContain('command failed: git pull');
    });

    it('accumulates "invalid " messages', () => {
      FollowLogStreamService.handleIteration('invalid configuration value', true, false, '');
      expect(FollowLogStreamService.errors).toContain('invalid configuration value');
    });

    it('accumulates "cannot be found" messages', () => {
      FollowLogStreamService.handleIteration('Assembly cannot be found', true, false, '');
      expect(FollowLogStreamService.errors).toContain('Assembly cannot be found');
    });

    it('appends message to output', () => {
      const result = FollowLogStreamService.handleIteration('Some normal log line', true, false, 'previous output\n');
      expect(result.output).toContain('Some normal log line');
      expect(result.output).toContain('previous output');
    });

    it('preserves shouldCleanup value', () => {
      const result = FollowLogStreamService.handleIteration('normal message', true, true, '');
      expect(result.shouldCleanup).toBe(true);
    });

    it('does not change shouldReadLogs for normal messages', () => {
      const result = FollowLogStreamService.handleIteration('Just a regular build log', true, false, '');
      expect(result.shouldReadLogs).toBe(true);
    });

    it('includes accumulated errors in Build fail GitHub check message', () => {
      FollowLogStreamService.errors = '\nprevious error';
      FollowLogStreamService.handleIteration('Build fail', true, false, '');
      const updateCall = (GitHub.updateGitHubCheck as jest.Mock).mock.calls[0];
      expect(updateCall[0]).toContain('previous error');
    });
  });
});
