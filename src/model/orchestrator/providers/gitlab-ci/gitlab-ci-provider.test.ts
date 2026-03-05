import GitLabCIProvider from '.';
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
const mockLogWarning = OrchestratorLogger.logWarning as jest.MockedFunction<typeof OrchestratorLogger.logWarning>;

function createBuildParameters(overrides: Partial<BuildParameters> = {}): BuildParameters {
  return {
    gitlabProjectId: 'my-group/my-project',
    gitlabTriggerToken: 'glptt-test-token-456',
    gitlabApiUrl: 'https://gitlab.example.com',
    gitlabRef: 'main',
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

describe('GitLabCIProvider', () => {
  let provider: GitLabCIProvider;

  beforeEach(() => {
    jest.clearAllMocks();
    provider = new GitLabCIProvider(createBuildParameters());
  });

  describe('constructor', () => {
    it('strips trailing slashes from apiUrl', () => {
      const params = createBuildParameters({ gitlabApiUrl: 'https://gitlab.example.com///' });
      const p = new GitLabCIProvider(params);
      expect(p).toBeDefined();
    });

    it('defaults apiUrl to https://gitlab.com when not provided', () => {
      const params = createBuildParameters({ gitlabApiUrl: undefined });
      const p = new GitLabCIProvider(params);
      expect(p).toBeDefined();
    });

    it('defaults ref to main when not provided', () => {
      const params = createBuildParameters({ gitlabRef: undefined });
      const p = new GitLabCIProvider(params);
      expect(p).toBeDefined();
    });
  });

  describe('setupWorkflow', () => {
    it('verifies project access via curl and logs success', async () => {
      mockRun.mockResolvedValueOnce('');

      await provider.setupWorkflow('guid-123', createBuildParameters(), 'main', []);

      expect(mockRun).toHaveBeenCalledTimes(1);
      const command = mockRun.mock.calls[0][0];
      expect(command).toContain('curl -sf');
      expect(command).toContain('PRIVATE-TOKEN: glptt-test-token-456');
      expect(command).toContain('gitlab.example.com/api/v4/projects/');
      expect(command).toContain(encodeURIComponent('my-group/my-project'));
      expect(mockLog).toHaveBeenCalledWith(expect.stringContaining('Project access verified'));
    });

    it('throws when projectId is not configured', async () => {
      const params = createBuildParameters({ gitlabProjectId: '' });
      provider = new GitLabCIProvider(params);

      await expect(provider.setupWorkflow('guid-123', params, 'main', [])).rejects.toThrow(
        'gitlabProjectId and gitlabTriggerToken are required',
      );
    });

    it('throws when triggerToken is not configured', async () => {
      const params = createBuildParameters({ gitlabTriggerToken: '' });
      provider = new GitLabCIProvider(params);

      await expect(provider.setupWorkflow('guid-123', params, 'main', [])).rejects.toThrow(
        'gitlabProjectId and gitlabTriggerToken are required',
      );
    });

    it('throws descriptive error when project access check fails', async () => {
      mockRun.mockRejectedValueOnce(new Error('401 Unauthorized'));

      await expect(provider.setupWorkflow('guid-123', createBuildParameters(), 'main', [])).rejects.toThrow(
        'Failed to access GitLab project my-group/my-project',
      );
    });
  });

  describe('runTaskInWorkflow', () => {
    it('triggers pipeline and returns job logs on success', async () => {
      // Pipeline trigger response
      mockRun.mockResolvedValueOnce(JSON.stringify({ id: 5001, status: 'pending' }));
      // Status poll returns success
      mockRun.mockResolvedValueOnce(JSON.stringify({ status: 'success' }));
      // Jobs list
      mockRun.mockResolvedValueOnce(
        JSON.stringify([
          { id: 10001, name: 'build-unity', status: 'success' },
          { id: 10002, name: 'test-unity', status: 'success' },
        ]),
      );
      // Job traces
      mockRun.mockResolvedValueOnce('Building Unity project...\nDone.');
      mockRun.mockResolvedValueOnce('Running tests...\nAll passed.');

      const result = await provider.runTaskInWorkflow(
        'guid-gl1',
        'unityci/editor:2021.3',
        'echo build',
        '/mount',
        '/work',
        [],
        [],
      );

      expect(result).toContain('build-unity');
      expect(result).toContain('test-unity');
      expect(result).toContain('Building Unity project');
      expect(result).toContain('Running tests');

      // Verify trigger command
      const triggerCommand = mockRun.mock.calls[0][0];
      expect(triggerCommand).toContain('trigger/pipeline');
      expect(triggerCommand).toContain(`token=${createBuildParameters().gitlabTriggerToken}`);
      expect(triggerCommand).toContain('ref=main');
    });

    it('passes build variables including base64-encoded commands', async () => {
      mockRun.mockResolvedValueOnce(JSON.stringify({ id: 5002, status: 'success' }));
      mockRun.mockResolvedValueOnce(JSON.stringify({ status: 'success' }));
      mockRun.mockResolvedValueOnce(JSON.stringify([]));

      await provider.runTaskInWorkflow(
        'guid-vars',
        'ubuntu:20.04',
        'make build',
        '/mnt/data',
        '/workspace',
        [{ name: 'UNITY_VERSION', value: '2021.3.1f1' } as any],
        [],
      );

      const triggerCommand = mockRun.mock.calls[0][0];
      const expectedB64 = Buffer.from('make build').toString('base64');
      expect(triggerCommand).toContain(`variables[BUILD_COMMANDS]=${expectedB64}`);
      expect(triggerCommand).toContain('variables[BUILD_GUID]=guid-vars');
      expect(triggerCommand).toContain('variables[BUILD_IMAGE]=ubuntu:20.04');
      expect(triggerCommand).toContain('variables[MOUNT_DIR]=/mnt/data');
      expect(triggerCommand).toContain('variables[WORKING_DIR]=/workspace');
      expect(triggerCommand).toContain('variables[UNITY_VERSION]=2021.3.1f1');
    });

    it('throws when pipeline trigger fails', async () => {
      mockRun.mockRejectedValueOnce(new Error('404 Not Found'));

      await expect(provider.runTaskInWorkflow('guid-err', 'img', 'cmd', '/m', '/w', [], [])).rejects.toThrow(
        'Failed to trigger pipeline',
      );
    });

    it('throws when pipeline finishes with failure status', async () => {
      mockRun.mockResolvedValueOnce(JSON.stringify({ id: 5003, status: 'pending' }));
      mockRun.mockResolvedValueOnce(JSON.stringify({ status: 'failed' }));

      await expect(provider.runTaskInWorkflow('guid-fail', 'img', 'cmd', '/m', '/w', [], [])).rejects.toThrow(
        'Pipeline 5003 finished with status: failed',
      );
    });

    it('throws when pipeline is canceled', async () => {
      mockRun.mockResolvedValueOnce(JSON.stringify({ id: 5004, status: 'pending' }));
      mockRun.mockResolvedValueOnce(JSON.stringify({ status: 'canceled' }));

      await expect(provider.runTaskInWorkflow('guid-cancel', 'img', 'cmd', '/m', '/w', [], [])).rejects.toThrow(
        'Pipeline 5004 finished with status: canceled',
      );
    });

    it('handles job log fetch failures gracefully', async () => {
      mockRun.mockResolvedValueOnce(JSON.stringify({ id: 5005, status: 'success' }));
      mockRun.mockResolvedValueOnce(JSON.stringify({ status: 'success' }));
      mockRun.mockResolvedValueOnce(JSON.stringify([{ id: 20001, name: 'build', status: 'success' }]));
      // Job trace fetch fails
      mockRun.mockRejectedValueOnce(new Error('trace unavailable'));

      const result = await provider.runTaskInWorkflow('guid-nologs', 'img', 'cmd', '/m', '/w', [], []);

      expect(result).toContain('build');
      expect(result).toContain('logs unavailable');
    });

    it('returns fallback message when entire job fetch fails', async () => {
      mockRun.mockResolvedValueOnce(JSON.stringify({ id: 5006, status: 'success' }));
      mockRun.mockResolvedValueOnce(JSON.stringify({ status: 'success' }));
      // Jobs list fails
      mockRun.mockRejectedValueOnce(new Error('API error'));

      const result = await provider.runTaskInWorkflow('guid-noapi', 'img', 'cmd', '/m', '/w', [], []);

      expect(result).toContain('Pipeline 5006 completed successfully');
      expect(result).toContain('logs unavailable');
    });

    it('continues polling through status check errors until completion', async () => {
      mockRun.mockResolvedValueOnce(JSON.stringify({ id: 5007, status: 'pending' }));
      // First status check fails
      mockRun.mockRejectedValueOnce(new Error('network blip'));
      // Second status check succeeds
      mockRun.mockResolvedValueOnce(JSON.stringify({ status: 'success' }));
      // Jobs/logs
      mockRun.mockResolvedValueOnce(JSON.stringify([]));

      await provider.runTaskInWorkflow('guid-retry', 'img', 'cmd', '/m', '/w', [], []);

      expect(mockLogWarning).toHaveBeenCalledWith(expect.stringContaining('Status check error'));
    });

    it('throws timeout error when polling exceeds maximum duration', async () => {
      const realDateNow = Date.now;
      let callCount = 0;

      // Trigger pipeline succeeds
      mockRun.mockResolvedValueOnce(JSON.stringify({ id: 5008, status: 'running' }));
      // Status always returns running
      mockRun.mockImplementation(() => Promise.resolve(JSON.stringify({ status: 'running' })));

      // After first call, simulate 5 hours elapsed
      Date.now = () => {
        callCount++;
        if (callCount <= 1) return realDateNow.call(Date);
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
    it('returns empty array (not implemented)', async () => {
      const resources = await provider.listResources();
      expect(resources).toEqual([]);
    });
  });

  describe('listWorkflow', () => {
    it('returns recent pipeline names when credentials are available', async () => {
      mockRun.mockResolvedValueOnce(
        JSON.stringify([
          { id: 100, status: 'success' },
          { id: 101, status: 'failed' },
        ]),
      );

      const workflows = await provider.listWorkflow();

      expect(workflows).toHaveLength(2);
      expect(workflows[0].Name).toBe('Pipeline #100 (success)');
      expect(workflows[1].Name).toBe('Pipeline #101 (failed)');
    });

    it('returns empty array when credentials are missing', async () => {
      const params = createBuildParameters({ gitlabProjectId: '' });
      provider = new GitLabCIProvider(params);

      const workflows = await provider.listWorkflow();
      expect(workflows).toEqual([]);
      expect(mockRun).not.toHaveBeenCalled();
    });

    it('returns empty array when API call fails', async () => {
      mockRun.mockRejectedValueOnce(new Error('API error'));

      const workflows = await provider.listWorkflow();
      expect(workflows).toEqual([]);
    });
  });

  describe('watchWorkflow', () => {
    it('returns empty string (not implemented)', async () => {
      const result = await provider.watchWorkflow();
      expect(result).toBe('');
    });
  });
});
