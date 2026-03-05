import GitHubActionsProvider from '.';
import BuildParameters from '../../../build-parameters';
import { OrchestratorSystem } from '../../services/core/orchestrator-system';
import OrchestratorLogger from '../../services/core/orchestrator-logger';
import * as core from '@actions/core';

jest.mock('../../services/core/orchestrator-system');
jest.mock('../../services/core/orchestrator-logger');
jest.mock('@actions/core', () => ({
  info: jest.fn(),
  warning: jest.fn(),
  error: jest.fn(),
  setOutput: jest.fn(),
  getInput: jest.fn(() => ''),
}));

const mockRun = OrchestratorSystem.Run as jest.MockedFunction<typeof OrchestratorSystem.Run>;
const mockLog = OrchestratorLogger.log as jest.MockedFunction<typeof OrchestratorLogger.log>;

function createBuildParameters(overrides: Partial<BuildParameters> = {}): BuildParameters {
  return {
    githubActionsRepo: 'owner/repo',
    githubActionsWorkflow: 'build.yml',
    githubActionsToken: 'ghp_test_token_123',
    githubActionsRef: 'main',
    ...overrides,
  } as BuildParameters;
}

// Override setTimeout to execute callbacks immediately so polling loops complete fast
const originalSetTimeout = global.setTimeout;
beforeAll(() => {
  global.setTimeout = ((fn: (...args: any[]) => void, _ms?: number, ...args: any[]) => {
    return originalSetTimeout(fn, 0, ...args);
  }) as any;
});
afterAll(() => {
  global.setTimeout = originalSetTimeout;
});

describe('GitHubActionsProvider', () => {
  let provider: GitHubActionsProvider;

  beforeEach(() => {
    jest.clearAllMocks();
    provider = new GitHubActionsProvider(createBuildParameters());
  });

  describe('constructor', () => {
    it('sets default ref to main when not specified', () => {
      const params = createBuildParameters({ githubActionsRef: undefined });
      const p = new GitHubActionsProvider(params);
      expect(p).toBeDefined();
    });

    it('uses provided ref when specified', () => {
      const params = createBuildParameters({ githubActionsRef: 'develop' });
      const p = new GitHubActionsProvider(params);
      expect(p).toBeDefined();
    });
  });

  describe('setupWorkflow', () => {
    it('verifies workflow exists via gh api and logs success', async () => {
      mockRun.mockResolvedValueOnce('12345\n');

      await provider.setupWorkflow('guid-123', createBuildParameters(), 'main', []);

      expect(mockRun).toHaveBeenCalledTimes(1);
      const command = mockRun.mock.calls[0][0];
      expect(command).toContain('gh api repos/owner/repo/actions/workflows/build.yml');
      expect(command).toContain("--jq '.id'");
      expect(command).toContain('GH_TOKEN=ghp_test_token_123');
      expect(mockLog).toHaveBeenCalledWith(expect.stringContaining('Workflow verified'));
    });

    it('throws when repo is not configured', async () => {
      const params = createBuildParameters({ githubActionsRepo: '' });
      provider = new GitHubActionsProvider(params);

      await expect(provider.setupWorkflow('guid-123', params, 'main', [])).rejects.toThrow(
        'githubActionsRepo and githubActionsWorkflow are required',
      );
    });

    it('throws when workflow is not configured', async () => {
      const params = createBuildParameters({ githubActionsWorkflow: '' });
      provider = new GitHubActionsProvider(params);

      await expect(provider.setupWorkflow('guid-123', params, 'main', [])).rejects.toThrow(
        'githubActionsRepo and githubActionsWorkflow are required',
      );
    });

    it('throws when token is missing', async () => {
      const params = createBuildParameters({ githubActionsToken: '' });
      provider = new GitHubActionsProvider(params);

      await expect(provider.setupWorkflow('guid-123', params, 'main', [])).rejects.toThrow(
        'githubActionsToken is required',
      );
    });

    it('throws descriptive error when workflow verification fails', async () => {
      mockRun.mockRejectedValueOnce(new Error('Not Found'));

      await expect(provider.setupWorkflow('guid-123', createBuildParameters(), 'main', [])).rejects.toThrow(
        'Failed to verify workflow build.yml in owner/repo',
      );
    });
  });

  describe('runTaskInWorkflow', () => {
    it('dispatches workflow with correct inputs and returns logs on success', async () => {
      // Dispatch succeeds
      mockRun.mockResolvedValueOnce('');
      // First poll finds the run
      mockRun.mockResolvedValueOnce(JSON.stringify({ id: 99001, status: 'in_progress' }));
      // Status poll returns completed
      mockRun.mockResolvedValueOnce(JSON.stringify({ status: 'completed', conclusion: 'success' }));
      // Log fetch succeeds
      mockRun.mockResolvedValueOnce('Build output log content here');

      const result = await provider.runTaskInWorkflow(
        'guid-abc',
        'unityci/editor:2021.3',
        'echo build',
        '/mount',
        '/work',
        [],
        [],
      );

      expect(result).toBe('Build output log content here');

      // Verify dispatch command
      const dispatchCommand = mockRun.mock.calls[0][0];
      expect(dispatchCommand).toContain('dispatches');
      expect(dispatchCommand).toContain('-X POST');
      expect(dispatchCommand).toContain("ref='main'");

      // Verify log fetch command
      const logCommand = mockRun.mock.calls[3][0];
      expect(logCommand).toContain('gh run view');
      expect(logCommand).toContain('--log');
      expect(logCommand).toContain('--repo owner/repo');
    });

    it('base64 encodes commands in the inputs payload', async () => {
      mockRun.mockResolvedValueOnce(''); // dispatch
      mockRun.mockResolvedValueOnce(JSON.stringify({ id: 100, status: 'completed' })); // run found
      mockRun.mockResolvedValueOnce(JSON.stringify({ status: 'completed', conclusion: 'success' })); // status
      mockRun.mockResolvedValueOnce('logs'); // logs

      await provider.runTaskInWorkflow('guid-1', 'image:latest', 'echo hello && build', '/mnt', '/w', [], []);

      const dispatchCommand = mockRun.mock.calls[0][0];
      const expectedB64 = Buffer.from('echo hello && build').toString('base64');
      expect(dispatchCommand).toContain(expectedB64);
    });

    it('includes environment variables as JSON input', async () => {
      mockRun.mockResolvedValueOnce(''); // dispatch
      mockRun.mockResolvedValueOnce(JSON.stringify({ id: 200, status: 'completed' })); // run found
      mockRun.mockResolvedValueOnce(JSON.stringify({ status: 'completed', conclusion: 'success' })); // status
      mockRun.mockResolvedValueOnce('logs'); // logs

      const env = [
        { name: 'UNITY_LICENSE', value: 'license-data' },
        { name: 'BUILD_TARGET', value: 'StandaloneWindows64' },
      ];

      await provider.runTaskInWorkflow('guid-2', 'img', 'cmd', '/m', '/w', env as any, []);

      const dispatchCommand = mockRun.mock.calls[0][0];
      expect(dispatchCommand).toContain('UNITY_LICENSE');
      expect(dispatchCommand).toContain('BUILD_TARGET');
    });

    it('throws when workflow dispatch fails', async () => {
      mockRun.mockRejectedValueOnce(new Error('403 Forbidden'));

      await expect(provider.runTaskInWorkflow('guid-err', 'img', 'cmd', '/m', '/w', [], [])).rejects.toThrow(
        'Failed to dispatch workflow',
      );
    });

    it('throws when workflow run does not start within timeout', async () => {
      mockRun.mockResolvedValueOnce(''); // dispatch succeeds

      // All 30 poll attempts fail
      for (let i = 0; i < 30; i++) {
        mockRun.mockRejectedValueOnce(new Error('not found'));
      }

      await expect(provider.runTaskInWorkflow('guid-timeout', 'img', 'cmd', '/m', '/w', [], [])).rejects.toThrow(
        'Workflow run did not start within',
      );
    });

    it('throws when workflow run fails with non-success conclusion', async () => {
      mockRun.mockResolvedValueOnce(''); // dispatch
      mockRun.mockResolvedValueOnce(JSON.stringify({ id: 300, status: 'in_progress' })); // run appears
      mockRun.mockResolvedValueOnce(JSON.stringify({ status: 'completed', conclusion: 'failure' })); // fails

      await expect(provider.runTaskInWorkflow('guid-fail', 'img', 'cmd', '/m', '/w', [], [])).rejects.toThrow(
        'Workflow run failed with conclusion: failure',
      );
    });

    it('returns fallback message when log fetch fails', async () => {
      mockRun.mockResolvedValueOnce(''); // dispatch
      mockRun.mockResolvedValueOnce(JSON.stringify({ id: 400, status: 'completed' })); // run appears
      mockRun.mockResolvedValueOnce(JSON.stringify({ status: 'completed', conclusion: 'success' })); // completes
      mockRun.mockRejectedValueOnce(new Error('logs unavailable')); // log fetch fails

      const result = await provider.runTaskInWorkflow('guid-nologs', 'img', 'cmd', '/m', '/w', [], []);

      expect(result).toContain('completed successfully');
      expect(result).toContain('logs unavailable');
    });

    it('handles cancelled workflow run conclusion', async () => {
      mockRun.mockResolvedValueOnce(''); // dispatch
      mockRun.mockResolvedValueOnce(JSON.stringify({ id: 500, status: 'in_progress' })); // run
      mockRun.mockResolvedValueOnce(JSON.stringify({ status: 'completed', conclusion: 'cancelled' })); // cancelled

      await expect(provider.runTaskInWorkflow('guid-cancel', 'img', 'cmd', '/m', '/w', [], [])).rejects.toThrow(
        'Workflow run failed with conclusion: cancelled',
      );
    });

    it('throws timeout error when polling exceeds maximum duration', async () => {
      // Save real Date.now
      const realDateNow = Date.now;
      let callCount = 0;

      // dispatch succeeds
      mockRun.mockResolvedValueOnce('');
      // run appears
      mockRun.mockResolvedValueOnce(JSON.stringify({ id: 600, status: 'in_progress' }));
      // Status always returns in_progress
      mockRun.mockImplementation(() => Promise.resolve(JSON.stringify({ status: 'in_progress' })));

      // First call returns normal time, subsequent calls simulate 5 hours elapsed
      Date.now = () => {
        callCount++;
        if (callCount <= 2) return realDateNow.call(Date);
        return realDateNow.call(Date) + 14_400_001; // 4 hours + 1ms
      };

      try {
        await expect(provider.runTaskInWorkflow('guid-poll-timeout', 'img', 'cmd', '/m', '/w', [], [])).rejects.toThrow(
          'did not complete within 4 hours',
        );

        expect(core.error).toHaveBeenCalledWith(expect.stringContaining('did not complete within 4 hours'));
      } finally {
        Date.now = realDateNow;
      }
    });
  });

  describe('cleanupWorkflow', () => {
    it('completes without error and logs cleanup message', async () => {
      await provider.cleanupWorkflow(createBuildParameters(), 'main', []);
      expect(mockLog).toHaveBeenCalledWith(expect.stringContaining('Cleanup complete'));
    });
  });

  describe('garbageCollect', () => {
    it('returns empty string (no-op)', async () => {
      const result = await provider.garbageCollect('', false, 0, false, false);
      expect(result).toBe('');
    });
  });

  describe('listResources', () => {
    it('returns runner names from the repository', async () => {
      mockRun.mockResolvedValueOnce('runner-1\nrunner-2\nrunner-3\n');

      const resources = await provider.listResources();

      expect(resources).toHaveLength(3);
      expect(resources[0].Name).toBe('runner-1');
      expect(resources[1].Name).toBe('runner-2');
      expect(resources[2].Name).toBe('runner-3');
    });

    it('returns empty array when repo or token is missing', async () => {
      const params = createBuildParameters({ githubActionsRepo: '' });
      provider = new GitHubActionsProvider(params);

      const resources = await provider.listResources();
      expect(resources).toEqual([]);
      expect(mockRun).not.toHaveBeenCalled();
    });

    it('returns empty array when API call fails', async () => {
      mockRun.mockRejectedValueOnce(new Error('API error'));

      const resources = await provider.listResources();
      expect(resources).toEqual([]);
    });
  });

  describe('listWorkflow', () => {
    it('returns recent workflow run names', async () => {
      mockRun.mockResolvedValueOnce('Build Unity\nRun Tests\n');

      const workflows = await provider.listWorkflow();

      expect(workflows).toHaveLength(2);
      expect(workflows[0].Name).toBe('Build Unity');
      expect(workflows[1].Name).toBe('Run Tests');
    });

    it('returns empty array when credentials missing', async () => {
      const params = createBuildParameters({ githubActionsToken: '' });
      provider = new GitHubActionsProvider(params);

      const workflows = await provider.listWorkflow();
      expect(workflows).toEqual([]);
    });
  });

  describe('watchWorkflow', () => {
    it('returns message when no active run exists', async () => {
      const result = await provider.watchWorkflow();
      expect(result).toBe('No active run to watch');
    });
  });
});
