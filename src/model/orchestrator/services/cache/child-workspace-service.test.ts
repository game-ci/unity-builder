import fs from 'node:fs';
import path from 'node:path';
import { ChildWorkspaceService, ChildWorkspaceConfig } from './child-workspace-service';

jest.mock('node:fs');
jest.mock('../core/orchestrator-logger', () => ({
  __esModule: true,
  default: {
    log: jest.fn(),
    logWarning: jest.fn(),
    error: jest.fn(),
  },
}));

const mockFs = fs as jest.Mocked<typeof fs>;

function createConfig(overrides: Partial<ChildWorkspaceConfig> = {}): ChildWorkspaceConfig {
  return {
    enabled: true,
    workspaceName: 'TurnOfWar',
    parentCacheRoot: '/cache/workspaces',
    preserveGitDirectory: true,
    separateLibraryCache: true,
    ...overrides,
  };
}

describe('ChildWorkspaceService', () => {
  beforeEach(() => {
    jest.resetAllMocks();
  });

  describe('initializeWorkspace', () => {
    it('should return false when no cached workspace exists', () => {
      (mockFs.existsSync as jest.Mock).mockReturnValue(false);

      const result = ChildWorkspaceService.initializeWorkspace('/project', createConfig());

      expect(result).toBe(false);
    });

    it('should return false when cached workspace is empty', () => {
      (mockFs.existsSync as jest.Mock).mockImplementation(
        (p: string) => String(p) === path.join('/cache/workspaces', 'TurnOfWar'),
      );
      (mockFs.readdirSync as jest.Mock).mockReturnValue([]);

      const result = ChildWorkspaceService.initializeWorkspace('/project', createConfig());

      expect(result).toBe(false);
      expect(mockFs.rmSync).toHaveBeenCalledWith(path.join('/cache/workspaces', 'TurnOfWar'), {
        recursive: true,
        force: true,
      });
    });

    it('should restore workspace via atomic move when cache exists', () => {
      const cachedPath = path.join('/cache/workspaces', 'TurnOfWar');
      (mockFs.existsSync as jest.Mock).mockImplementation((p: string) => {
        if (String(p) === cachedPath) return true;
        if (String(p) === '/project') return false;
        if (String(p) === '/') return true;

        return false;
      });
      (mockFs.readdirSync as jest.Mock).mockReturnValue(['Assets', '.git', 'Library']);

      const config = createConfig({ separateLibraryCache: false });
      const result = ChildWorkspaceService.initializeWorkspace('/project', config);

      expect(result).toBe(true);
      expect(mockFs.renameSync).toHaveBeenCalledWith(cachedPath, '/project');
    });

    it('should remove existing target path before restoring', () => {
      const cachedPath = path.join('/cache/workspaces', 'TurnOfWar');
      (mockFs.existsSync as jest.Mock).mockImplementation((p: string) => {
        if (String(p) === cachedPath) return true;
        if (String(p) === '/project') return true;

        return false;
      });
      (mockFs.readdirSync as jest.Mock).mockReturnValue(['Assets']);

      const config = createConfig({ separateLibraryCache: false });
      const result = ChildWorkspaceService.initializeWorkspace('/project', config);

      expect(result).toBe(true);
      expect(mockFs.rmSync).toHaveBeenCalledWith('/project', { recursive: true, force: true });
    });

    it('should restore Library cache separately when configured', () => {
      const cachedPath = path.join('/cache/workspaces', 'TurnOfWar');
      const libraryBackupPath = path.join('/cache/workspaces', 'TurnOfWar-Library');
      const libraryDestination = path.join('/project', 'Library');

      (mockFs.existsSync as jest.Mock).mockImplementation((p: string) => {
        if (String(p) === cachedPath) return true;
        if (String(p) === '/project') return false;
        if (String(p) === libraryBackupPath) return true;
        if (String(p) === libraryDestination) return false;

        return true; // parent dirs
      });
      (mockFs.readdirSync as jest.Mock).mockReturnValue(['Assets', 'ProjectSettings']);

      const result = ChildWorkspaceService.initializeWorkspace('/project', createConfig());

      expect(result).toBe(true);

      // Should have been called twice: once for workspace, once for Library
      expect(mockFs.renameSync).toHaveBeenCalledTimes(2);
      expect(mockFs.renameSync).toHaveBeenCalledWith(cachedPath, '/project');
      expect(mockFs.renameSync).toHaveBeenCalledWith(libraryBackupPath, libraryDestination);
    });

    it('should return false and log warning on error', () => {
      (mockFs.existsSync as jest.Mock).mockImplementation(() => {
        throw new Error('Access denied');
      });

      const result = ChildWorkspaceService.initializeWorkspace('/project', createConfig());

      expect(result).toBe(false);
    });
  });

  describe('saveWorkspace', () => {
    it('should skip save when project path does not exist', () => {
      (mockFs.existsSync as jest.Mock).mockReturnValue(false);

      ChildWorkspaceService.saveWorkspace('/project', createConfig());

      expect(mockFs.renameSync).not.toHaveBeenCalled();
    });

    it('should save workspace via atomic move', () => {
      const cachedPath = path.join('/cache/workspaces', 'TurnOfWar');
      (mockFs.existsSync as jest.Mock).mockImplementation((p: string) => {
        if (String(p) === '/project') return true;
        if (String(p) === path.join('/project', 'Library')) return false;
        if (String(p) === '/cache/workspaces') return true;
        if (String(p) === cachedPath) return false;

        return false;
      });

      const config = createConfig({ separateLibraryCache: false });
      ChildWorkspaceService.saveWorkspace('/project', config);

      expect(mockFs.renameSync).toHaveBeenCalledWith('/project', cachedPath);
    });

    it('should remove .git directory when preserveGit is false', () => {
      const gitDirectory = path.join('/project', '.git');
      (mockFs.existsSync as jest.Mock).mockImplementation((p: string) => {
        if (String(p) === '/project') return true;
        if (String(p) === gitDirectory) return true;
        if (String(p) === path.join('/project', 'Library')) return false;
        if (String(p) === '/cache/workspaces') return true;

        return false;
      });

      const config = createConfig({ preserveGitDirectory: false, separateLibraryCache: false });
      ChildWorkspaceService.saveWorkspace('/project', config);

      expect(mockFs.rmSync).toHaveBeenCalledWith(gitDirectory, { recursive: true, force: true });
    });

    it('should not remove .git directory when preserveGit is true', () => {
      (mockFs.existsSync as jest.Mock).mockImplementation((p: string) => {
        if (String(p) === '/project') return true;
        if (String(p) === path.join('/project', 'Library')) return false;
        if (String(p) === '/cache/workspaces') return true;

        return false;
      });

      const config = createConfig({ preserveGitDirectory: true, separateLibraryCache: false });
      ChildWorkspaceService.saveWorkspace('/project', config);

      // rmSync should not have been called with .git path
      const rmSyncCalls = (mockFs.rmSync as jest.Mock).mock.calls;
      const gitRmCalls = rmSyncCalls.filter((call: any[]) => String(call[0]).includes('.git'));
      expect(gitRmCalls).toHaveLength(0);
    });

    it('should remove existing cached workspace before saving', () => {
      const cachedPath = path.join('/cache/workspaces', 'TurnOfWar');
      (mockFs.existsSync as jest.Mock).mockImplementation((p: string) => {
        if (String(p) === '/project') return true;
        if (String(p) === path.join('/project', 'Library')) return false;
        if (String(p) === '/cache/workspaces') return true;
        if (String(p) === cachedPath) return true;

        return false;
      });

      const config = createConfig({ separateLibraryCache: false });
      ChildWorkspaceService.saveWorkspace('/project', config);

      expect(mockFs.rmSync).toHaveBeenCalledWith(cachedPath, { recursive: true, force: true });
      expect(mockFs.renameSync).toHaveBeenCalledWith('/project', cachedPath);
    });

    it('should save Library separately when separateLibraryCache is true', () => {
      const libraryPath = path.join('/project', 'Library');
      const libraryBackupPath = path.join('/cache/workspaces', 'TurnOfWar-Library');
      (mockFs.existsSync as jest.Mock).mockImplementation((p: string) => {
        if (String(p) === '/project') return true;
        if (String(p) === libraryPath) return true;
        if (String(p) === libraryBackupPath) return false;
        if (String(p) === '/cache/workspaces') return true;

        return false;
      });
      (mockFs.readdirSync as jest.Mock).mockReturnValue(['ScriptAssemblies', 'ShaderCache']);

      ChildWorkspaceService.saveWorkspace('/project', createConfig());

      expect(mockFs.renameSync).toHaveBeenCalledWith(libraryPath, libraryBackupPath);
    });

    it('should handle save errors gracefully', () => {
      (mockFs.existsSync as jest.Mock).mockReturnValue(true);
      (mockFs.renameSync as jest.Mock).mockImplementation(() => {
        throw new Error('Cross-device link');
      });
      (mockFs.readdirSync as jest.Mock).mockReturnValue([]);

      // Should not throw
      ChildWorkspaceService.saveWorkspace('/project', createConfig({ separateLibraryCache: false }));
    });
  });

  describe('restoreLibraryCache', () => {
    it('should return false when no Library backup exists', () => {
      (mockFs.existsSync as jest.Mock).mockReturnValue(false);

      const result = ChildWorkspaceService.restoreLibraryCache('/project', createConfig());

      expect(result).toBe(false);
    });

    it('should return false when Library backup is empty', () => {
      const libraryBackup = path.join('/cache/workspaces', 'TurnOfWar-Library');
      (mockFs.existsSync as jest.Mock).mockImplementation((p: string) => String(p) === libraryBackup);
      (mockFs.readdirSync as jest.Mock).mockReturnValue([]);

      const result = ChildWorkspaceService.restoreLibraryCache('/project', createConfig());

      expect(result).toBe(false);
      expect(mockFs.rmSync).toHaveBeenCalledWith(libraryBackup, { recursive: true, force: true });
    });

    it('should restore Library via atomic move', () => {
      const libraryBackup = path.join('/cache/workspaces', 'TurnOfWar-Library');
      const libraryDestination = path.join('/project', 'Library');
      (mockFs.existsSync as jest.Mock).mockImplementation((p: string) => {
        if (String(p) === libraryBackup) return true;
        if (String(p) === libraryDestination) return false;

        return false;
      });
      (mockFs.readdirSync as jest.Mock).mockReturnValue(['ScriptAssemblies']);

      const result = ChildWorkspaceService.restoreLibraryCache('/project', createConfig());

      expect(result).toBe(true);
      expect(mockFs.renameSync).toHaveBeenCalledWith(libraryBackup, libraryDestination);
    });

    it('should use custom libraryBackupPath when provided', () => {
      const customBackup = '/custom/library/cache';
      const libraryDestination = path.join('/project', 'Library');
      (mockFs.existsSync as jest.Mock).mockImplementation((p: string) => {
        if (String(p) === customBackup) return true;
        if (String(p) === libraryDestination) return false;

        return false;
      });
      (mockFs.readdirSync as jest.Mock).mockReturnValue(['ScriptAssemblies']);

      const config = createConfig({ libraryBackupPath: customBackup });
      const result = ChildWorkspaceService.restoreLibraryCache('/project', config);

      expect(result).toBe(true);
      expect(mockFs.renameSync).toHaveBeenCalledWith(customBackup, libraryDestination);
    });

    it('should remove existing Library directory before restore', () => {
      const libraryBackup = path.join('/cache/workspaces', 'TurnOfWar-Library');
      const libraryDestination = path.join('/project', 'Library');
      (mockFs.existsSync as jest.Mock).mockImplementation((p: string) => {
        if (String(p) === libraryBackup) return true;
        if (String(p) === libraryDestination) return true;

        return false;
      });
      (mockFs.readdirSync as jest.Mock).mockReturnValue(['ScriptAssemblies']);

      ChildWorkspaceService.restoreLibraryCache('/project', createConfig());

      expect(mockFs.rmSync).toHaveBeenCalledWith(libraryDestination, { recursive: true, force: true });
    });
  });

  describe('getWorkspaceSize', () => {
    it('should return "0 B" for non-existent directory', () => {
      (mockFs.existsSync as jest.Mock).mockReturnValue(false);

      const result = ChildWorkspaceService.getWorkspaceSize('/nonexistent');

      expect(result).toBe('0 B');
    });

    it('should calculate and format directory size', () => {
      (mockFs.existsSync as jest.Mock).mockReturnValue(true);
      (mockFs.readdirSync as jest.Mock).mockReturnValue([
        { name: 'file1.txt', isDirectory: () => false, isFile: () => true },
        { name: 'file2.bin', isDirectory: () => false, isFile: () => true },
      ]);
      (mockFs.statSync as jest.Mock).mockReturnValue({ size: 1024 * 1024 }); // 1 MB each

      const result = ChildWorkspaceService.getWorkspaceSize('/workspace');

      expect(result).toBe('2.00 MB');
    });

    it('should return "unknown" when existsSync throws', () => {
      (mockFs.existsSync as jest.Mock).mockImplementation(() => {
        throw new Error('Permission denied');
      });

      const result = ChildWorkspaceService.getWorkspaceSize('/workspace');

      expect(result).toBe('unknown');
    });

    it('should recurse into subdirectories', () => {
      (mockFs.existsSync as jest.Mock).mockReturnValue(true);
      let callCount = 0;
      (mockFs.readdirSync as jest.Mock).mockImplementation(() => {
        callCount++;
        if (callCount === 1) {
          return [
            { name: 'subdir', isDirectory: () => true, isFile: () => false },
            { name: 'root.txt', isDirectory: () => false, isFile: () => true },
          ];
        }

        return [{ name: 'nested.txt', isDirectory: () => false, isFile: () => true }];
      });
      (mockFs.statSync as jest.Mock).mockReturnValue({ size: 512 });

      const result = ChildWorkspaceService.getWorkspaceSize('/workspace');

      expect(result).toBe('1.00 KB');
    });
  });

  describe('cleanStaleWorkspaces', () => {
    it('should skip when cache root does not exist', () => {
      (mockFs.existsSync as jest.Mock).mockReturnValue(false);

      ChildWorkspaceService.cleanStaleWorkspaces('/nonexistent', 7);

      expect(mockFs.readdirSync).not.toHaveBeenCalled();
    });

    it('should remove workspaces older than retention period', () => {
      const now = Date.now();
      const tenDaysAgo = now - 10 * 24 * 60 * 60 * 1000;
      const oneDayAgo = now - 1 * 24 * 60 * 60 * 1000;

      (mockFs.existsSync as jest.Mock).mockReturnValue(true);
      (mockFs.readdirSync as jest.Mock).mockImplementation((directoryPath: string) => {
        if (String(directoryPath) === '/cache') {
          return ['old-workspace', 'recent-workspace'];
        }

        return [];
      });
      (mockFs.statSync as jest.Mock).mockImplementation((filePath: string) => ({
        isDirectory: () => true,
        mtimeMs: String(filePath).includes('old') ? tenDaysAgo : oneDayAgo,
        size: 0,
      }));

      ChildWorkspaceService.cleanStaleWorkspaces('/cache', 7);

      expect(mockFs.rmSync).toHaveBeenCalledTimes(1);
      expect(mockFs.rmSync).toHaveBeenCalledWith(path.join('/cache', 'old-workspace'), {
        recursive: true,
        force: true,
      });
    });

    it('should not remove workspaces newer than retention period', () => {
      const oneDayAgo = Date.now() - 1 * 24 * 60 * 60 * 1000;

      (mockFs.existsSync as jest.Mock).mockReturnValue(true);
      (mockFs.readdirSync as jest.Mock).mockReturnValue(['recent-workspace']);
      (mockFs.statSync as jest.Mock).mockReturnValue({
        isDirectory: () => true,
        mtimeMs: oneDayAgo,
      });

      ChildWorkspaceService.cleanStaleWorkspaces('/cache', 7);

      expect(mockFs.rmSync).not.toHaveBeenCalled();
    });

    it('should handle errors during cleanup gracefully', () => {
      (mockFs.existsSync as jest.Mock).mockReturnValue(true);
      (mockFs.readdirSync as jest.Mock).mockReturnValue(['broken-workspace']);
      (mockFs.statSync as jest.Mock).mockImplementation(() => {
        throw new Error('Access denied');
      });

      // Should not throw
      ChildWorkspaceService.cleanStaleWorkspaces('/cache', 7);
    });
  });

  describe('buildConfig', () => {
    it('should build config from build parameters', () => {
      const config = ChildWorkspaceService.buildConfig({
        childWorkspacesEnabled: true,
        childWorkspaceName: 'Shell',
        childWorkspaceCacheRoot: '/d/cache',
        childWorkspacePreserveGit: false,
        childWorkspaceSeparateLibrary: true,
      });

      expect(config).toEqual({
        enabled: true,
        workspaceName: 'Shell',
        parentCacheRoot: '/d/cache',
        preserveGitDirectory: false,
        separateLibraryCache: true,
      });
    });

    it('should build config with defaults from disabled state', () => {
      const config = ChildWorkspaceService.buildConfig({
        childWorkspacesEnabled: false,
        childWorkspaceName: '',
        childWorkspaceCacheRoot: '',
        childWorkspacePreserveGit: true,
        childWorkspaceSeparateLibrary: true,
      });

      expect(config.enabled).toBe(false);
    });
  });
});
