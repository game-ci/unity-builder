import { execSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { BuildReliabilityService } from './build-reliability-service';

// Mock dependencies
jest.mock('node:child_process');
jest.mock('node:fs');
jest.mock('@actions/core', () => ({
  info: jest.fn(),
  warning: jest.fn(),
}));

const mockExecSync = execSync as jest.MockedFunction<typeof execSync>;
const mockFs = fs as jest.Mocked<typeof fs>;

describe('BuildReliabilityService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  // =========================================================================
  // checkGitIntegrity
  // =========================================================================

  describe('checkGitIntegrity', () => {
    it('should return true when fsck succeeds with clean output', () => {
      mockExecSync.mockReturnValue('');
      const result = BuildReliabilityService.checkGitIntegrity('/repo');
      expect(result).toBe(true);
      expect(mockExecSync).toHaveBeenCalledWith(
        'git -C "/repo" fsck --no-dangling',
        expect.objectContaining({ encoding: 'utf8' }),
      );
    });

    it('should return false when fsck output contains corruption indicators', () => {
      mockExecSync.mockReturnValue('broken link from tree abc123');
      const result = BuildReliabilityService.checkGitIntegrity('/repo');
      expect(result).toBe(false);
    });

    it('should return false when fsck output contains missing objects', () => {
      mockExecSync.mockReturnValue('missing blob abc123');
      const result = BuildReliabilityService.checkGitIntegrity('/repo');
      expect(result).toBe(false);
    });

    it('should return false when execSync throws (non-zero exit code)', () => {
      mockExecSync.mockImplementation(() => {
        const error: any = new Error('fsck failed');
        error.stderr = Buffer.from('error: bad object HEAD');
        throw error;
      });
      const result = BuildReliabilityService.checkGitIntegrity('/repo');
      expect(result).toBe(false);
    });

    it('should use current directory when no repoPath provided', () => {
      mockExecSync.mockReturnValue('');
      BuildReliabilityService.checkGitIntegrity();
      expect(mockExecSync).toHaveBeenCalledWith('git -C "." fsck --no-dangling', expect.anything());
    });
  });

  // =========================================================================
  // cleanStaleLockFiles
  // =========================================================================

  describe('cleanStaleLockFiles', () => {
    it('should return 0 when .git directory does not exist', () => {
      mockFs.existsSync.mockReturnValue(false);
      const result = BuildReliabilityService.cleanStaleLockFiles('/repo');
      expect(result).toBe(0);
    });

    it('should remove lock files older than 10 minutes', () => {
      const now = Date.now();
      const oldTime = now - 15 * 60 * 1000; // 15 minutes ago

      mockFs.existsSync.mockReturnValue(true);
      mockFs.statSync.mockImplementation((filePath: any) => {
        if (filePath === path.join('/repo', '.git')) {
          return { isDirectory: () => true } as fs.Stats;
        }
        return { mtimeMs: oldTime } as fs.Stats;
      });
      mockFs.readdirSync.mockImplementation((dir: any) => {
        if (dir === path.join('/repo', '.git')) {
          return [
            { name: 'index.lock', isDirectory: () => false },
            { name: 'HEAD.lock', isDirectory: () => false },
          ] as any;
        }
        return [];
      });
      mockFs.unlinkSync.mockReturnValue(undefined);

      const result = BuildReliabilityService.cleanStaleLockFiles('/repo');
      expect(result).toBe(2);
      expect(mockFs.unlinkSync).toHaveBeenCalledTimes(2);
    });

    it('should NOT remove lock files younger than 10 minutes', () => {
      const now = Date.now();
      const recentTime = now - 2 * 60 * 1000; // 2 minutes ago

      mockFs.existsSync.mockReturnValue(true);
      mockFs.statSync.mockImplementation((filePath: any) => {
        if (filePath === path.join('/repo', '.git')) {
          return { isDirectory: () => true } as fs.Stats;
        }
        return { mtimeMs: recentTime } as fs.Stats;
      });
      mockFs.readdirSync.mockImplementation((dir: any) => {
        if (dir === path.join('/repo', '.git')) {
          return [{ name: 'index.lock', isDirectory: () => false }] as any;
        }
        return [];
      });

      const result = BuildReliabilityService.cleanStaleLockFiles('/repo');
      expect(result).toBe(0);
      expect(mockFs.unlinkSync).not.toHaveBeenCalled();
    });

    it('should recursively scan refs directory for lock files', () => {
      const now = Date.now();
      const oldTime = now - 15 * 60 * 1000;

      mockFs.existsSync.mockReturnValue(true);
      mockFs.statSync.mockImplementation((filePath: any) => {
        if (filePath === path.join('/repo', '.git')) {
          return { isDirectory: () => true } as fs.Stats;
        }
        return { mtimeMs: oldTime } as fs.Stats;
      });
      mockFs.readdirSync.mockImplementation((dir: any) => {
        const gitDir = path.join('/repo', '.git');
        if (dir === gitDir) {
          return [{ name: 'refs', isDirectory: () => true }] as any;
        }
        if (dir === path.join(gitDir, 'refs')) {
          return [{ name: 'heads', isDirectory: () => true }] as any;
        }
        if (dir === path.join(gitDir, 'refs', 'heads')) {
          return [{ name: 'main.lock', isDirectory: () => false }] as any;
        }
        return [];
      });
      mockFs.unlinkSync.mockReturnValue(undefined);

      const result = BuildReliabilityService.cleanStaleLockFiles('/repo');
      expect(result).toBe(1);
    });
  });

  // =========================================================================
  // validateSubmoduleBackingStores
  // =========================================================================

  describe('validateSubmoduleBackingStores', () => {
    it('should return empty array when .gitmodules does not exist', () => {
      mockFs.existsSync.mockReturnValue(false);
      const result = BuildReliabilityService.validateSubmoduleBackingStores('/repo');
      expect(result).toEqual([]);
    });

    it('should detect broken backing store for submodule', () => {
      mockFs.existsSync.mockImplementation((p: any) => {
        if (p === path.join('/repo', '.gitmodules')) return true;
        if (p === path.join('/repo', 'lib/sub', '.git')) return true;
        // Backing store does not exist
        return false;
      });
      mockFs.readFileSync.mockImplementation((p: any) => {
        if (p === path.join('/repo', '.gitmodules')) {
          return '[submodule "sub"]\n\tpath = lib/sub\n\turl = https://example.com/sub.git';
        }
        if (p === path.join('/repo', 'lib/sub', '.git')) {
          return 'gitdir: ../../.git/modules/lib/sub';
        }
        return '';
      });
      mockFs.statSync.mockReturnValue({ isFile: () => true } as fs.Stats);

      const result = BuildReliabilityService.validateSubmoduleBackingStores('/repo');
      expect(result).toContain('lib/sub');
    });

    it('should return empty array when all submodule backing stores are valid', () => {
      mockFs.existsSync.mockReturnValue(true);
      mockFs.readFileSync.mockImplementation((p: any) => {
        if (p === path.join('/repo', '.gitmodules')) {
          return '[submodule "sub"]\n\tpath = lib/sub\n\turl = https://example.com/sub.git';
        }
        if (p === path.join('/repo', 'lib/sub', '.git')) {
          return 'gitdir: ../../.git/modules/lib/sub';
        }
        return '';
      });
      mockFs.statSync.mockReturnValue({ isFile: () => true } as fs.Stats);

      const result = BuildReliabilityService.validateSubmoduleBackingStores('/repo');
      expect(result).toEqual([]);
    });
  });

  // =========================================================================
  // recoverCorruptedRepo
  // =========================================================================

  describe('recoverCorruptedRepo', () => {
    it('should orchestrate fsck cleanup and re-fetch, returning true on success', () => {
      // cleanStaleLockFiles: no .git dir
      mockFs.existsSync.mockReturnValue(false);
      mockFs.statSync.mockReturnValue({ isDirectory: () => false } as fs.Stats);

      // fetch succeeds, then fsck succeeds
      mockExecSync.mockReturnValue('');

      const result = BuildReliabilityService.recoverCorruptedRepo('/repo');
      expect(result).toBe(true);
      // Should have called fetch
      expect(mockExecSync).toHaveBeenCalledWith('git -C "/repo" fetch --all', expect.anything());
    });

    it('should return false when recovery fails to restore integrity', () => {
      mockFs.existsSync.mockReturnValue(false);
      mockFs.statSync.mockReturnValue({ isDirectory: () => false } as fs.Stats);

      // fetch succeeds, but fsck fails
      mockExecSync.mockImplementation((cmd: any) => {
        if (typeof cmd === 'string' && cmd.includes('fetch')) return '';
        if (typeof cmd === 'string' && cmd.includes('fsck')) {
          return 'missing blob abc123';
        }
        return '';
      });

      const result = BuildReliabilityService.recoverCorruptedRepo('/repo');
      expect(result).toBe(false);
    });

    it('should continue recovery even when fetch fails', () => {
      mockFs.existsSync.mockReturnValue(false);
      mockFs.statSync.mockReturnValue({ isDirectory: () => false } as fs.Stats);

      let callCount = 0;
      mockExecSync.mockImplementation((cmd: any) => {
        callCount++;
        if (typeof cmd === 'string' && cmd.includes('fetch')) {
          throw new Error('network error');
        }
        // fsck call
        return '';
      });

      const result = BuildReliabilityService.recoverCorruptedRepo('/repo');
      // Should still attempt fsck after failed fetch
      expect(callCount).toBeGreaterThanOrEqual(2);
    });
  });

  // =========================================================================
  // cleanReservedFilenames
  // =========================================================================

  describe('cleanReservedFilenames', () => {
    it('should return empty array when Assets directory does not exist', () => {
      mockFs.existsSync.mockReturnValue(false);
      const result = BuildReliabilityService.cleanReservedFilenames('/project');
      expect(result).toEqual([]);
    });

    it('should remove files with reserved names (con, prn, aux, nul)', () => {
      mockFs.existsSync.mockReturnValue(true);
      mockFs.readdirSync.mockImplementation((dir: any) => {
        if (dir === path.join('/project', 'Assets')) {
          return [
            { name: 'con.txt', isDirectory: () => false },
            { name: 'PRN.meta', isDirectory: () => false },
            { name: 'aux.shader', isDirectory: () => false },
            { name: 'nul.png', isDirectory: () => false },
            { name: 'valid-file.cs', isDirectory: () => false },
          ] as any;
        }
        return [];
      });
      mockFs.unlinkSync.mockReturnValue(undefined);

      const result = BuildReliabilityService.cleanReservedFilenames('/project');
      expect(result).toHaveLength(4);
      expect(mockFs.unlinkSync).toHaveBeenCalledTimes(4);
    });

    it('should remove directories with reserved names', () => {
      mockFs.existsSync.mockReturnValue(true);
      mockFs.readdirSync.mockImplementation((dir: any) => {
        if (dir === path.join('/project', 'Assets')) {
          return [{ name: 'com1', isDirectory: () => true }] as any;
        }
        return [];
      });
      mockFs.rmSync.mockReturnValue(undefined);

      const result = BuildReliabilityService.cleanReservedFilenames('/project');
      expect(result).toHaveLength(1);
      expect(mockFs.rmSync).toHaveBeenCalledWith(path.join('/project', 'Assets', 'com1'), {
        recursive: true,
        force: true,
      });
    });

    it('should detect COM1 through COM9 and LPT1 through LPT9', () => {
      mockFs.existsSync.mockReturnValue(true);
      mockFs.readdirSync.mockImplementation((dir: any) => {
        if (dir === path.join('/project', 'Assets')) {
          return [
            { name: 'com1.txt', isDirectory: () => false },
            { name: 'COM9.meta', isDirectory: () => false },
            { name: 'lpt1.dat', isDirectory: () => false },
            { name: 'LPT9.log', isDirectory: () => false },
          ] as any;
        }
        return [];
      });
      mockFs.unlinkSync.mockReturnValue(undefined);

      const result = BuildReliabilityService.cleanReservedFilenames('/project');
      expect(result).toHaveLength(4);
    });

    it('should not remove files that merely contain reserved names as substrings', () => {
      mockFs.existsSync.mockReturnValue(true);
      mockFs.readdirSync.mockImplementation((dir: any) => {
        if (dir === path.join('/project', 'Assets')) {
          return [
            { name: 'controller.cs', isDirectory: () => false },
            { name: 'printer-utils.cs', isDirectory: () => false },
            { name: 'auxiliary.shader', isDirectory: () => false },
          ] as any;
        }
        return [];
      });

      const result = BuildReliabilityService.cleanReservedFilenames('/project');
      expect(result).toHaveLength(0);
    });
  });

  // =========================================================================
  // archiveBuildOutput
  // =========================================================================

  describe('archiveBuildOutput', () => {
    it('should skip archiving when source path does not exist', () => {
      mockFs.existsSync.mockReturnValue(false);
      BuildReliabilityService.archiveBuildOutput('/builds/output', '/archives');
      expect(mockExecSync).not.toHaveBeenCalled();
    });

    it('should create archive directory and tar.gz output', () => {
      mockFs.existsSync.mockReturnValue(true);
      mockFs.mkdirSync.mockReturnValue(undefined as any);
      mockExecSync.mockReturnValue('');

      BuildReliabilityService.archiveBuildOutput('/builds/output', '/archives');

      expect(mockFs.mkdirSync).toHaveBeenCalledWith('/archives', { recursive: true });
      expect(mockExecSync).toHaveBeenCalledWith(expect.stringContaining('tar -czf'), expect.anything());
    });
  });

  // =========================================================================
  // enforceRetention
  // =========================================================================

  describe('enforceRetention', () => {
    it('should return 0 when archive path does not exist', () => {
      mockFs.existsSync.mockReturnValue(false);
      const result = BuildReliabilityService.enforceRetention('/archive', 30);
      expect(result).toBe(0);
    });

    it('should remove archives older than retention period', () => {
      const now = Date.now();
      const oldTime = now - 45 * 24 * 60 * 60 * 1000; // 45 days ago
      const recentTime = now - 5 * 24 * 60 * 60 * 1000; // 5 days ago

      mockFs.existsSync.mockReturnValue(true);
      mockFs.readdirSync.mockReturnValue([
        { name: 'build-old.tar.gz', isDirectory: () => false },
        { name: 'build-recent.tar.gz', isDirectory: () => false },
      ] as any);
      mockFs.statSync.mockImplementation((p: any) => {
        if ((p as string).includes('old')) {
          return { mtimeMs: oldTime } as fs.Stats;
        }
        return { mtimeMs: recentTime } as fs.Stats;
      });
      mockFs.unlinkSync.mockReturnValue(undefined);

      const result = BuildReliabilityService.enforceRetention('/archive', 30);
      expect(result).toBe(1);
      expect(mockFs.unlinkSync).toHaveBeenCalledTimes(1);
    });

    it('should keep all archives within retention period', () => {
      const now = Date.now();
      const recentTime = now - 5 * 24 * 60 * 60 * 1000;

      mockFs.existsSync.mockReturnValue(true);
      mockFs.readdirSync.mockReturnValue([
        { name: 'build-1.tar.gz', isDirectory: () => false },
        { name: 'build-2.tar.gz', isDirectory: () => false },
      ] as any);
      mockFs.statSync.mockReturnValue({ mtimeMs: recentTime } as fs.Stats);

      const result = BuildReliabilityService.enforceRetention('/archive', 30);
      expect(result).toBe(0);
    });
  });

  // =========================================================================
  // configureGitEnvironment
  // =========================================================================

  describe('configureGitEnvironment', () => {
    it('should set GIT_TERMINAL_PROMPT=0 in process.env', () => {
      mockExecSync.mockReturnValue('');
      BuildReliabilityService.configureGitEnvironment();
      expect(process.env.GIT_TERMINAL_PROMPT).toBe('0');
    });

    it('should configure http.postBuffer via git config', () => {
      mockExecSync.mockReturnValue('');
      BuildReliabilityService.configureGitEnvironment();
      expect(mockExecSync).toHaveBeenCalledWith('git config --global http.postBuffer 524288000', expect.anything());
    });

    it('should configure core.longpaths via git config', () => {
      mockExecSync.mockReturnValue('');
      BuildReliabilityService.configureGitEnvironment();
      expect(mockExecSync).toHaveBeenCalledWith('git config --global core.longpaths true', expect.anything());
    });

    it('should warn but not throw when git config commands fail', () => {
      const core = require('@actions/core');
      mockExecSync.mockImplementation(() => {
        throw new Error('git config failed');
      });

      // Should not throw
      expect(() => BuildReliabilityService.configureGitEnvironment()).not.toThrow();
      expect(core.warning).toHaveBeenCalled();
    });
  });
});
