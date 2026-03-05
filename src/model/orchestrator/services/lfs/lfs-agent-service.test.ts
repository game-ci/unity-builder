import fs from 'node:fs';
import path from 'node:path';
import { LfsAgentService } from './lfs-agent-service';

// Mock dependencies
jest.mock('node:fs');
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

const mockFs = fs as jest.Mocked<typeof fs>;

describe('LfsAgentService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('configure', () => {
    it('should call correct git config commands when agent exists', async () => {
      (mockFs.existsSync as jest.Mock).mockReturnValue(true);

      const { OrchestratorSystem } = require('../core/orchestrator-system');

      await LfsAgentService.configure(
        '/usr/local/bin/elastic-git-storage',
        '--verbose',
        ['/storage/path1', '/storage/path2'],
        '/repo',
      );

      expect(OrchestratorSystem.Run).toHaveBeenCalledWith(
        `git -C "/repo" config lfs.customtransfer.elastic-git-storage.path "/usr/local/bin/elastic-git-storage"`,
      );
      expect(OrchestratorSystem.Run).toHaveBeenCalledWith(
        `git -C "/repo" config lfs.customtransfer.elastic-git-storage.args "--verbose"`,
      );
      expect(OrchestratorSystem.Run).toHaveBeenCalledWith(
        `git -C "/repo" config lfs.standalonetransferagent elastic-git-storage`,
      );
    });

    it('should set LFS_STORAGE_PATHS environment variable when storagePaths provided', async () => {
      (mockFs.existsSync as jest.Mock).mockReturnValue(true);

      await LfsAgentService.configure('/usr/local/bin/elastic-git-storage', '', ['/path/a', '/path/b'], '/repo');

      expect(process.env.LFS_STORAGE_PATHS).toBe('/path/a;/path/b');
    });

    it('should log warning and return early when agent executable does not exist', async () => {
      (mockFs.existsSync as jest.Mock).mockReturnValue(false);

      const { OrchestratorSystem } = require('../core/orchestrator-system');

      await LfsAgentService.configure('/nonexistent/agent', '', [], '/repo');

      expect(OrchestratorSystem.Run).not.toHaveBeenCalled();
    });

    it('should derive agent name from executable filename', async () => {
      (mockFs.existsSync as jest.Mock).mockReturnValue(true);

      const { OrchestratorSystem } = require('../core/orchestrator-system');

      await LfsAgentService.configure('/tools/my-custom-agent.exe', '', [], '/repo');

      expect(OrchestratorSystem.Run).toHaveBeenCalledWith(
        `git -C "/repo" config lfs.customtransfer.my-custom-agent.path "/tools/my-custom-agent.exe"`,
      );
    });
  });

  describe('configure with empty storagePaths', () => {
    it('should not set LFS_STORAGE_PATHS when storagePaths is empty', async () => {
      (mockFs.existsSync as jest.Mock).mockReturnValue(true);

      const originalValue = process.env.LFS_STORAGE_PATHS;
      delete process.env.LFS_STORAGE_PATHS;

      await LfsAgentService.configure('/usr/local/bin/agent', '', [], '/repo');

      expect(process.env.LFS_STORAGE_PATHS).toBeUndefined();

      if (originalValue !== undefined) {
        process.env.LFS_STORAGE_PATHS = originalValue;
      }
    });
  });

  describe('validate', () => {
    it('should return true when agent executable exists', async () => {
      (mockFs.existsSync as jest.Mock).mockReturnValue(true);
      const result = await LfsAgentService.validate('/usr/local/bin/elastic-git-storage');
      expect(result).toBe(true);
    });

    it('should return false when agent executable does not exist', async () => {
      (mockFs.existsSync as jest.Mock).mockReturnValue(false);
      const result = await LfsAgentService.validate('/nonexistent/agent');
      expect(result).toBe(false);
    });

    it('should log warning when agent does not exist', async () => {
      (mockFs.existsSync as jest.Mock).mockReturnValue(false);
      const OrchestratorLogger = require('../core/orchestrator-logger').default;

      await LfsAgentService.validate('/nonexistent/agent');

      expect(OrchestratorLogger.logWarning).toHaveBeenCalledWith(expect.stringContaining('Agent executable not found'));
    });
  });
});
