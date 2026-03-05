import fs from 'node:fs';
import path from 'node:path';
import { LocalCacheService } from './local-cache-service';

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
  });

  describe('saveLibraryCache', () => {
    it('should skip save when Library folder does not exist', async () => {
      (mockFs.existsSync as jest.Mock).mockReturnValue(false);
      await LocalCacheService.saveLibraryCache('/project', '/cache', 'key1');
      // Should not throw, just log and return
      expect(mockFs.mkdirSync).not.toHaveBeenCalled();
    });

    it('should create cache directory structure', async () => {
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
    });
  });

  describe('garbageCollect', () => {
    it('should skip when cache root does not exist', async () => {
      (mockFs.existsSync as jest.Mock).mockReturnValue(false);
      await LocalCacheService.garbageCollect('/nonexistent');
      // Should not throw
    });
  });
});
