import fs from 'node:fs';
import path from 'node:path';
import { LocalCacheService } from './local-cache-service';

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

describe('LocalCacheService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('generateCacheKey', () => {
    it('should generate a key from platform, version, and branch', () => {
      const key = LocalCacheService.generateCacheKey('StandaloneLinux64', '2021.3.1f1', 'main');
      expect(key).toBe('StandaloneLinux64-2021_3_1f1-main');
    });

    it('should sanitize non-alphanumeric characters except hyphens', () => {
      const key = LocalCacheService.generateCacheKey('WebGL', '2022.3.0f1', 'feature/my-branch');
      expect(key).toBe('WebGL-2022_3_0f1-feature_my-branch');
    });

    it('should handle empty branch', () => {
      const key = LocalCacheService.generateCacheKey('StandaloneWindows64', '2021.3.1f1', '');
      expect(key).toBe('StandaloneWindows64-2021_3_1f1-');
    });

    it('should handle dots in version string', () => {
      const key = LocalCacheService.generateCacheKey('Android', '6000.0.23f1', 'main');
      expect(key).toBe('Android-6000_0_23f1-main');
    });

    it('should preserve hyphens in platform names', () => {
      const key = LocalCacheService.generateCacheKey('Standalone-Linux64', '2021.3.1f1', 'main');
      expect(key).toBe('Standalone-Linux64-2021_3_1f1-main');
    });
  });

  describe('resolveCacheRoot', () => {
    const originalEnv = process.env;

    beforeEach(() => {
      process.env = { ...originalEnv };
    });

    afterEach(() => {
      process.env = originalEnv;
    });

    it('should use localCacheRoot when set', () => {
      const result = LocalCacheService.resolveCacheRoot({ localCacheRoot: '/custom/cache' });
      expect(result).toBe('/custom/cache');
    });

    it('should use RUNNER_TEMP when localCacheRoot is empty', () => {
      process.env.RUNNER_TEMP = '/tmp/runner';
      const result = LocalCacheService.resolveCacheRoot({ localCacheRoot: '' });
      expect(result).toBe(path.join('/tmp/runner', 'game-ci-cache'));
    });

    it('should fall back to .game-ci/cache when neither is set', () => {
      delete process.env.RUNNER_TEMP;
      const result = LocalCacheService.resolveCacheRoot({ localCacheRoot: '' });
      expect(result).toBe(path.join(process.cwd(), '.game-ci', 'cache'));
    });
  });

  describe('restoreLibraryCache', () => {
    it('should return false on cache miss (directory does not exist)', async () => {
      (mockFs.existsSync as jest.Mock).mockReturnValue(false);
      const result = await LocalCacheService.restoreLibraryCache('/project', '/cache', 'key1');
      expect(result).toBe(false);
    });

    it('should return false when cache directory has no tar files', async () => {
      (mockFs.existsSync as jest.Mock).mockReturnValue(true);
      (mockFs.readdirSync as jest.Mock).mockReturnValue(['readme.txt', 'info.json']);
      const result = await LocalCacheService.restoreLibraryCache('/project', '/cache', 'key1');
      expect(result).toBe(false);
    });

    it('should restore from the latest tar file on cache hit', async () => {
      (mockFs.existsSync as jest.Mock).mockReturnValue(true);
      (mockFs.readdirSync as jest.Mock).mockReturnValue(['lib-1000.tar', 'lib-2000.tar']);
      (mockFs.statSync as jest.Mock).mockImplementation((filePath: string) => ({
        mtimeMs: String(filePath).includes('lib-2000') ? 2000 : 1000,
      }));
      (mockFs.mkdirSync as jest.Mock).mockReturnValue(undefined);

      const { OrchestratorSystem } = require('../core/orchestrator-system');

      const result = await LocalCacheService.restoreLibraryCache('/project', '/cache', 'key1');

      expect(result).toBe(true);
      expect(OrchestratorSystem.Run).toHaveBeenCalledWith(
        expect.stringContaining('lib-2000.tar'),
        true,
      );
    });

    it('should return false and log warning on error', async () => {
      (mockFs.existsSync as jest.Mock).mockReturnValue(true);
      (mockFs.readdirSync as jest.Mock).mockImplementation(() => {
        throw new Error('Permission denied');
      });

      const result = await LocalCacheService.restoreLibraryCache('/project', '/cache', 'key1');
      expect(result).toBe(false);
    });
  });

  describe('saveLibraryCache', () => {
    it('should skip save when Library folder does not exist', async () => {
      (mockFs.existsSync as jest.Mock).mockReturnValue(false);
      await LocalCacheService.saveLibraryCache('/project', '/cache', 'key1');
      expect(mockFs.mkdirSync).not.toHaveBeenCalled();
    });

    it('should skip save when Library folder is empty', async () => {
      (mockFs.existsSync as jest.Mock).mockReturnValue(true);
      (mockFs.readdirSync as jest.Mock).mockReturnValue([]);
      await LocalCacheService.saveLibraryCache('/project', '/cache', 'key1');
      expect(mockFs.mkdirSync).not.toHaveBeenCalled();
    });

    it('should create cache directory and save tar', async () => {
      (mockFs.existsSync as jest.Mock).mockReturnValue(true);
      (mockFs.readdirSync as jest.Mock).mockImplementation((dirPath: string) => {
        if (String(dirPath).includes('Library') && !String(dirPath).includes('cache')) {
          return ['file1.asset', 'file2.asset'];
        }
        return [];
      });
      (mockFs.statSync as jest.Mock).mockReturnValue({ mtimeMs: Date.now() });
      (mockFs.mkdirSync as jest.Mock).mockReturnValue(undefined);

      const { OrchestratorSystem } = require('../core/orchestrator-system');
      OrchestratorSystem.Run.mockResolvedValue('');

      await LocalCacheService.saveLibraryCache('/project', '/cache', 'key1');
      expect(mockFs.mkdirSync).toHaveBeenCalledWith(path.join('/cache', 'key1', 'Library'), { recursive: true });
      expect(OrchestratorSystem.Run).toHaveBeenCalledWith(
        expect.stringContaining('tar -cf'),
        true,
      );
    });
  });

  describe('restoreLfsCache', () => {
    it('should return false on cache miss', async () => {
      (mockFs.existsSync as jest.Mock).mockReturnValue(false);
      const result = await LocalCacheService.restoreLfsCache('/repo', '/cache', 'key1');
      expect(result).toBe(false);
    });

    it('should return false when no tar files exist', async () => {
      (mockFs.existsSync as jest.Mock).mockReturnValue(true);
      (mockFs.readdirSync as jest.Mock).mockReturnValue(['readme.txt']);
      const result = await LocalCacheService.restoreLfsCache('/repo', '/cache', 'key1');
      expect(result).toBe(false);
    });

    it('should restore from latest tar on hit', async () => {
      (mockFs.existsSync as jest.Mock).mockReturnValue(true);
      (mockFs.readdirSync as jest.Mock).mockReturnValue(['lfs-100.tar', 'lfs-200.tar']);
      (mockFs.statSync as jest.Mock).mockImplementation((filePath: string) => ({
        mtimeMs: String(filePath).includes('lfs-200') ? 200 : 100,
      }));
      (mockFs.mkdirSync as jest.Mock).mockReturnValue(undefined);

      const { OrchestratorSystem } = require('../core/orchestrator-system');
      const result = await LocalCacheService.restoreLfsCache('/repo', '/cache', 'key1');

      expect(result).toBe(true);
      expect(OrchestratorSystem.Run).toHaveBeenCalledWith(
        expect.stringContaining('lfs-200.tar'),
        true,
      );
    });
  });

  describe('saveLfsCache', () => {
    it('should skip when .git/lfs does not exist', async () => {
      (mockFs.existsSync as jest.Mock).mockReturnValue(false);
      await LocalCacheService.saveLfsCache('/repo', '/cache', 'key1');
      expect(mockFs.mkdirSync).not.toHaveBeenCalled();
    });

    it('should skip when .git/lfs is empty', async () => {
      (mockFs.existsSync as jest.Mock).mockReturnValue(true);
      (mockFs.readdirSync as jest.Mock).mockReturnValue([]);
      await LocalCacheService.saveLfsCache('/repo', '/cache', 'key1');
      expect(mockFs.mkdirSync).not.toHaveBeenCalled();
    });

    it('should create cache directory and save tar when lfs has content', async () => {
      (mockFs.existsSync as jest.Mock).mockReturnValue(true);
      (mockFs.readdirSync as jest.Mock).mockImplementation((dirPath: string) => {
        if (String(dirPath).includes('lfs') && !String(dirPath).includes('cache')) {
          return ['objects', 'tmp'];
        }
        return [];
      });
      (mockFs.statSync as jest.Mock).mockReturnValue({ mtimeMs: Date.now() });
      (mockFs.mkdirSync as jest.Mock).mockReturnValue(undefined);

      const { OrchestratorSystem } = require('../core/orchestrator-system');
      OrchestratorSystem.Run.mockResolvedValue('');

      await LocalCacheService.saveLfsCache('/repo', '/cache', 'key1');
      expect(mockFs.mkdirSync).toHaveBeenCalledWith(path.join('/cache', 'key1', 'lfs'), { recursive: true });
      expect(OrchestratorSystem.Run).toHaveBeenCalledWith(
        expect.stringContaining('tar -cf'),
        true,
      );
    });

    it('should handle save errors gracefully', async () => {
      (mockFs.existsSync as jest.Mock).mockReturnValue(true);
      (mockFs.readdirSync as jest.Mock).mockImplementation(() => {
        throw new Error('Disk full');
      });

      // Should not throw
      await LocalCacheService.saveLfsCache('/repo', '/cache', 'key1');
    });
  });

  describe('garbageCollect', () => {
    it('should skip when cache root does not exist', async () => {
      (mockFs.existsSync as jest.Mock).mockReturnValue(false);
      await LocalCacheService.garbageCollect('/nonexistent');
    });

    it('should remove directories older than maxAgeDays', async () => {
      const now = Date.now();
      const eightDaysAgo = now - 8 * 24 * 60 * 60 * 1000;
      const oneDayAgo = now - 1 * 24 * 60 * 60 * 1000;

      (mockFs.existsSync as jest.Mock).mockReturnValue(true);
      (mockFs.readdirSync as jest.Mock).mockReturnValue(['old-cache', 'recent-cache']);
      (mockFs.statSync as jest.Mock).mockImplementation((filePath: string) => ({
        isDirectory: () => true,
        mtimeMs: String(filePath).includes('old') ? eightDaysAgo : oneDayAgo,
      }));
      (mockFs.rmSync as jest.Mock).mockReturnValue(undefined);

      await LocalCacheService.garbageCollect('/cache', 7);

      expect(mockFs.rmSync).toHaveBeenCalledTimes(1);
      expect(mockFs.rmSync).toHaveBeenCalledWith(
        path.join('/cache', 'old-cache'),
        { recursive: true, force: true },
      );
    });

    it('should not remove directories newer than maxAgeDays', async () => {
      const oneDayAgo = Date.now() - 1 * 24 * 60 * 60 * 1000;

      (mockFs.existsSync as jest.Mock).mockReturnValue(true);
      (mockFs.readdirSync as jest.Mock).mockReturnValue(['recent-cache']);
      (mockFs.statSync as jest.Mock).mockReturnValue({
        isDirectory: () => true,
        mtimeMs: oneDayAgo,
      });

      await LocalCacheService.garbageCollect('/cache', 7);

      expect(mockFs.rmSync).not.toHaveBeenCalled();
    });
  });
});
