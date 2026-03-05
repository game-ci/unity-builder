import fs from 'node:fs';
import os from 'node:os';
import { ElasticGitStorageService } from './elastic-git-storage-service';

jest.mock('node:fs');
jest.mock('node:os');
jest.mock('../core/orchestrator-system', () => ({
  OrchestratorSystem: {
    Run: jest.fn().mockResolvedValue(''),
  },
}));
jest.mock('../core/orchestrator-logger', () => ({
  __esModule: true,
  default: {
    log: jest.fn(),
    logWarning: jest.fn(),
    error: jest.fn(),
  },
}));
jest.mock('./lfs-agent-service', () => ({
  LfsAgentService: {
    configure: jest.fn().mockResolvedValue(undefined),
  },
}));

const mockFs = fs as jest.Mocked<typeof fs>;
const mockOs = os as jest.Mocked<typeof os>;

describe('ElasticGitStorageService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('parseAgentValue', () => {
    it('should parse name without version', () => {
      const result = ElasticGitStorageService.parseAgentValue('elastic-git-storage');
      expect(result.name).toBe('elastic-git-storage');
      expect(result.version).toBe('latest');
    });

    it('should parse name@version', () => {
      const result = ElasticGitStorageService.parseAgentValue('elastic-git-storage@v1.0.0');
      expect(result.name).toBe('elastic-git-storage');
      expect(result.version).toBe('v1.0.0');
    });

    it('should parse name@latest', () => {
      const result = ElasticGitStorageService.parseAgentValue('elastic-git-storage@latest');
      expect(result.name).toBe('elastic-git-storage');
      expect(result.version).toBe('latest');
    });

    it('should handle trailing @ as latest', () => {
      const result = ElasticGitStorageService.parseAgentValue('elastic-git-storage@');
      expect(result.name).toBe('elastic-git-storage');
      expect(result.version).toBe('latest');
    });

    it('should handle whitespace', () => {
      const result = ElasticGitStorageService.parseAgentValue('  elastic-git-storage@v2.0.0  ');
      expect(result.name).toBe('elastic-git-storage');
      expect(result.version).toBe('v2.0.0');
    });
  });

  describe('isElasticGitStorage', () => {
    it('should match exact name', () => {
      expect(ElasticGitStorageService.isElasticGitStorage('elastic-git-storage')).toBe(true);
    });

    it('should match with .exe extension', () => {
      expect(ElasticGitStorageService.isElasticGitStorage('elastic-git-storage.exe')).toBe(true);
    });

    it('should match with @version suffix', () => {
      expect(ElasticGitStorageService.isElasticGitStorage('elastic-git-storage@v1.0.0')).toBe(true);
    });

    it('should match with @latest suffix', () => {
      expect(ElasticGitStorageService.isElasticGitStorage('elastic-git-storage@latest')).toBe(true);
    });

    it('should match forward-slash path', () => {
      expect(ElasticGitStorageService.isElasticGitStorage('/usr/local/bin/elastic-git-storage')).toBe(true);
    });

    it('should match backslash path', () => {
      expect(ElasticGitStorageService.isElasticGitStorage('C:\\tools\\elastic-git-storage')).toBe(true);
    });

    it('should match path with .exe', () => {
      expect(ElasticGitStorageService.isElasticGitStorage('C:\\tools\\elastic-git-storage.exe')).toBe(true);
    });

    it('should be case-insensitive', () => {
      expect(ElasticGitStorageService.isElasticGitStorage('Elastic-Git-Storage')).toBe(true);
    });

    it('should handle whitespace', () => {
      expect(ElasticGitStorageService.isElasticGitStorage('  elastic-git-storage  ')).toBe(true);
    });

    it('should not match other agent names', () => {
      expect(ElasticGitStorageService.isElasticGitStorage('lfs-folderstore')).toBe(false);
    });

    it('should return false for empty string', () => {
      expect(ElasticGitStorageService.isElasticGitStorage('')).toBe(false);
    });

    it('should not match partial names', () => {
      expect(ElasticGitStorageService.isElasticGitStorage('my-elastic-git-storage-v2')).toBe(false);
    });
  });

  describe('findInstalled', () => {
    it('should find on PATH via which/where', async () => {
      const { OrchestratorSystem } = require('../core/orchestrator-system');
      mockOs.platform.mockReturnValue('linux');
      OrchestratorSystem.Run.mockResolvedValue('/usr/local/bin/elastic-git-storage\n');
      (mockFs.existsSync as jest.Mock).mockReturnValue(true);

      const result = await ElasticGitStorageService.findInstalled();
      expect(result).toBe('/usr/local/bin/elastic-git-storage');
    });

    it('should use where on windows', async () => {
      const { OrchestratorSystem } = require('../core/orchestrator-system');
      mockOs.platform.mockReturnValue('win32');
      OrchestratorSystem.Run.mockResolvedValue('C:\\tools\\elastic-git-storage.exe\n');
      (mockFs.existsSync as jest.Mock).mockReturnValue(true);

      const result = await ElasticGitStorageService.findInstalled();
      expect(result).toBe('C:\\tools\\elastic-git-storage.exe');
      expect(OrchestratorSystem.Run).toHaveBeenCalledWith(
        expect.stringContaining('where'),
        false,
        true,
      );
    });

    it('should check common install locations when not on PATH', async () => {
      const { OrchestratorSystem } = require('../core/orchestrator-system');
      mockOs.platform.mockReturnValue('linux');
      mockOs.homedir.mockReturnValue('/home/runner');
      OrchestratorSystem.Run.mockRejectedValue(new Error('not found'));
      (mockFs.existsSync as jest.Mock)
        .mockReturnValueOnce(false) // RUNNER_TOOL_CACHE
        .mockReturnValueOnce(true); // /usr/local/bin

      const result = await ElasticGitStorageService.findInstalled();
      expect(result).toBe('/usr/local/bin/elastic-git-storage');
    });

    it('should return empty string when not found anywhere', async () => {
      const { OrchestratorSystem } = require('../core/orchestrator-system');
      mockOs.platform.mockReturnValue('linux');
      mockOs.homedir.mockReturnValue('/home/runner');
      OrchestratorSystem.Run.mockRejectedValue(new Error('not found'));
      (mockFs.existsSync as jest.Mock).mockReturnValue(false);

      const result = await ElasticGitStorageService.findInstalled();
      expect(result).toBe('');
    });

    it('should check windows-specific locations on win32', async () => {
      const { OrchestratorSystem } = require('../core/orchestrator-system');
      mockOs.platform.mockReturnValue('win32');
      mockOs.homedir.mockReturnValue('C:\\Users\\runner');
      OrchestratorSystem.Run.mockRejectedValue(new Error('not found'));

      const originalEnv = { ...process.env };
      process.env.LOCALAPPDATA = 'C:\\Users\\runner\\AppData\\Local';
      process.env.RUNNER_TOOL_CACHE = '';

      (mockFs.existsSync as jest.Mock).mockImplementation((p: string) => {
        return p.includes('AppData');
      });

      const result = await ElasticGitStorageService.findInstalled();
      expect(result).toContain('elastic-git-storage.exe');

      process.env = originalEnv;
    });
  });

  describe('install', () => {
    it('should download correct binary for linux amd64', async () => {
      const { OrchestratorSystem } = require('../core/orchestrator-system');
      mockOs.platform.mockReturnValue('linux');
      mockOs.arch.mockReturnValue('x64');
      mockOs.tmpdir.mockReturnValue('/tmp');
      OrchestratorSystem.Run.mockResolvedValue('');
      (mockFs.existsSync as jest.Mock).mockReturnValue(true);

      const result = await ElasticGitStorageService.install('latest');

      expect(OrchestratorSystem.Run).toHaveBeenCalledWith(
        expect.stringContaining('elastic-git-storage_linux_amd64'),
      );
      expect(OrchestratorSystem.Run).toHaveBeenCalledWith(
        expect.stringContaining('chmod +x'),
      );
      expect(result).toContain('elastic-git-storage');
    });

    it('should download correct binary for darwin arm64', async () => {
      const { OrchestratorSystem } = require('../core/orchestrator-system');
      mockOs.platform.mockReturnValue('darwin');
      mockOs.arch.mockReturnValue('arm64');
      mockOs.tmpdir.mockReturnValue('/tmp');
      (mockFs.existsSync as jest.Mock).mockReturnValue(true);

      await ElasticGitStorageService.install('v1.2.0');

      expect(OrchestratorSystem.Run).toHaveBeenCalledWith(
        expect.stringContaining('elastic-git-storage_darwin_arm64'),
      );
      expect(OrchestratorSystem.Run).toHaveBeenCalledWith(
        expect.stringContaining('v1.2.0'),
      );
    });

    it('should download .exe for windows', async () => {
      const { OrchestratorSystem } = require('../core/orchestrator-system');
      mockOs.platform.mockReturnValue('win32');
      mockOs.arch.mockReturnValue('x64');
      mockOs.tmpdir.mockReturnValue('C:\\temp');
      (mockFs.existsSync as jest.Mock).mockReturnValue(true);

      await ElasticGitStorageService.install('latest');

      expect(OrchestratorSystem.Run).toHaveBeenCalledWith(
        expect.stringContaining('elastic-git-storage_windows_amd64.exe'),
      );
      // Should NOT chmod on windows
      expect(OrchestratorSystem.Run).not.toHaveBeenCalledWith(
        expect.stringContaining('chmod'),
      );
    });

    it('should use RUNNER_TOOL_CACHE for install dir when available', async () => {
      const { OrchestratorSystem } = require('../core/orchestrator-system');
      mockOs.platform.mockReturnValue('linux');
      mockOs.arch.mockReturnValue('x64');
      OrchestratorSystem.Run.mockResolvedValue('');

      const originalCache = process.env.RUNNER_TOOL_CACHE;
      process.env.RUNNER_TOOL_CACHE = '/opt/hostedtoolcache';

      (mockFs.existsSync as jest.Mock).mockReturnValue(true);

      const result = await ElasticGitStorageService.install('latest');
      expect(result).toContain('hostedtoolcache');

      if (originalCache === undefined) {
        delete process.env.RUNNER_TOOL_CACHE;
      } else {
        process.env.RUNNER_TOOL_CACHE = originalCache;
      }
    });

    it('should use latest release URL when version is latest', async () => {
      const { OrchestratorSystem } = require('../core/orchestrator-system');
      mockOs.platform.mockReturnValue('linux');
      mockOs.arch.mockReturnValue('x64');
      mockOs.tmpdir.mockReturnValue('/tmp');
      (mockFs.existsSync as jest.Mock).mockReturnValue(true);

      await ElasticGitStorageService.install('latest');

      expect(OrchestratorSystem.Run).toHaveBeenCalledWith(
        expect.stringContaining('/releases/latest/download/'),
      );
    });

    it('should use tagged release URL when version is specified', async () => {
      const { OrchestratorSystem } = require('../core/orchestrator-system');
      mockOs.platform.mockReturnValue('linux');
      mockOs.arch.mockReturnValue('x64');
      mockOs.tmpdir.mockReturnValue('/tmp');
      (mockFs.existsSync as jest.Mock).mockReturnValue(true);

      await ElasticGitStorageService.install('v2.0.0');

      expect(OrchestratorSystem.Run).toHaveBeenCalledWith(
        expect.stringContaining('/releases/download/v2.0.0/'),
      );
    });

    it('should return empty string on download failure', async () => {
      const { OrchestratorSystem } = require('../core/orchestrator-system');
      mockOs.platform.mockReturnValue('linux');
      mockOs.arch.mockReturnValue('x64');
      mockOs.tmpdir.mockReturnValue('/tmp');
      OrchestratorSystem.Run.mockRejectedValue(new Error('curl failed'));

      const result = await ElasticGitStorageService.install('latest');
      expect(result).toBe('');
    });

    it('should return empty string if binary not found after download', async () => {
      const { OrchestratorSystem } = require('../core/orchestrator-system');
      mockOs.platform.mockReturnValue('linux');
      mockOs.arch.mockReturnValue('x64');
      mockOs.tmpdir.mockReturnValue('/tmp');
      (mockFs.existsSync as jest.Mock).mockReturnValue(false);

      const result = await ElasticGitStorageService.install('latest');
      expect(result).toBe('');
    });
  });

  describe('ensureAndConfigure', () => {
    it('should use existing installation if found', async () => {
      const { LfsAgentService } = require('./lfs-agent-service');
      const { OrchestratorSystem } = require('../core/orchestrator-system');
      mockOs.platform.mockReturnValue('linux');
      mockOs.homedir.mockReturnValue('/home/runner');
      // findInstalled returns a result
      OrchestratorSystem.Run.mockResolvedValue('/usr/local/bin/elastic-git-storage\n');
      (mockFs.existsSync as jest.Mock).mockReturnValue(true);

      const result = await ElasticGitStorageService.ensureAndConfigure(
        'latest',
        '--verbose',
        ['/mnt/lfs'],
        '/repo',
      );

      expect(result).toBe('/usr/local/bin/elastic-git-storage');
      expect(LfsAgentService.configure).toHaveBeenCalledWith(
        '/usr/local/bin/elastic-git-storage',
        '--verbose',
        ['/mnt/lfs'],
        '/repo',
      );
    });

    it('should install when not found and configure', async () => {
      const { LfsAgentService } = require('./lfs-agent-service');
      const { OrchestratorSystem } = require('../core/orchestrator-system');
      mockOs.platform.mockReturnValue('linux');
      mockOs.arch.mockReturnValue('x64');
      mockOs.homedir.mockReturnValue('/home/runner');
      mockOs.tmpdir.mockReturnValue('/tmp');

      // findInstalled finds nothing
      OrchestratorSystem.Run
        .mockRejectedValueOnce(new Error('not found')) // which
        .mockResolvedValueOnce('') // curl download
        .mockResolvedValueOnce(''); // chmod

      (mockFs.existsSync as jest.Mock)
        .mockReturnValueOnce(false) // RUNNER_TOOL_CACHE
        .mockReturnValueOnce(false) // /usr/local/bin
        .mockReturnValueOnce(false) // ~/.local/bin
        .mockReturnValueOnce(true); // after install

      const result = await ElasticGitStorageService.ensureAndConfigure(
        'v1.0.0',
        '',
        [],
        '/repo',
      );

      expect(result).toContain('elastic-git-storage');
      expect(LfsAgentService.configure).toHaveBeenCalled();
    });

    it('should return empty string when install fails', async () => {
      const { OrchestratorSystem } = require('../core/orchestrator-system');
      mockOs.platform.mockReturnValue('linux');
      mockOs.arch.mockReturnValue('x64');
      mockOs.homedir.mockReturnValue('/home/runner');
      mockOs.tmpdir.mockReturnValue('/tmp');

      // findInstalled finds nothing
      OrchestratorSystem.Run.mockRejectedValue(new Error('not found'));
      (mockFs.existsSync as jest.Mock).mockReturnValue(false);

      const result = await ElasticGitStorageService.ensureAndConfigure(
        'latest',
        '',
        [],
        '/repo',
      );

      expect(result).toBe('');
    });

    it('should use default version when empty string passed', async () => {
      const { OrchestratorSystem } = require('../core/orchestrator-system');
      mockOs.platform.mockReturnValue('linux');
      mockOs.arch.mockReturnValue('x64');
      mockOs.homedir.mockReturnValue('/home/runner');
      mockOs.tmpdir.mockReturnValue('/tmp');

      // findInstalled finds nothing
      OrchestratorSystem.Run
        .mockRejectedValueOnce(new Error('not found'))
        .mockResolvedValueOnce('')
        .mockResolvedValueOnce('');

      (mockFs.existsSync as jest.Mock)
        .mockReturnValueOnce(false)
        .mockReturnValueOnce(false)
        .mockReturnValueOnce(false)
        .mockReturnValueOnce(true);

      await ElasticGitStorageService.ensureAndConfigure('', '', [], '/repo');

      expect(OrchestratorSystem.Run).toHaveBeenCalledWith(
        expect.stringContaining('/releases/latest/download/'),
      );
    });
  });

  describe('constants', () => {
    it('should have correct repo owner', () => {
      expect(ElasticGitStorageService.REPO_OWNER).toBe('frostebite');
    });

    it('should have correct repo name', () => {
      expect(ElasticGitStorageService.REPO_NAME).toBe('elastic-git-storage');
    });

    it('should have correct agent name', () => {
      expect(ElasticGitStorageService.AGENT_NAME).toBe('elastic-git-storage');
    });
  });
});
