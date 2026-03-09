import { OrchestratorFolders } from './orchestrator-folders';

// Mock Orchestrator
jest.mock('../orchestrator', () => ({
  __esModule: true,
  default: {
    buildParameters: {
      buildGuid: 'test-guid-abc',
      cacheKey: 'my-cache-key',
      projectPath: 'test-project',
      buildPath: 'Builds',
      maxRetainedWorkspaces: 0,
      gitPrivateToken: 'ghp_test123',
      gitAuthMode: 'url',
      orchestratorRepoName: 'game-ci/unity-builder',
      githubRepo: 'user/my-game',
    },
    lockedWorkspace: '',
  },
}));

jest.mock('../../build-parameters', () => ({
  __esModule: true,
  default: {
    shouldUseRetainedWorkspaceMode: jest.fn().mockReturnValue(false),
  },
}));

jest.mock('./orchestrator-options', () => ({
  __esModule: true,
  default: {
    useSharedBuilder: false,
  },
}));

// Normalize paths for cross-platform test compatibility
const normalize = (p: string) => p.replace(/\\/g, '/');

describe('OrchestratorFolders', () => {
  describe('static constants', () => {
    it('repositoryFolder is "repo"', () => {
      expect(OrchestratorFolders.repositoryFolder).toBe('repo');
    });

    it('buildVolumeFolder is "data"', () => {
      expect(OrchestratorFolders.buildVolumeFolder).toBe('data');
    });

    it('cacheFolder is "cache"', () => {
      expect(OrchestratorFolders.cacheFolder).toBe('cache');
    });
  });

  describe('ToLinuxFolder', () => {
    it('converts backslashes to forward slashes', () => {
      expect(OrchestratorFolders.ToLinuxFolder('C:\\Users\\test\\project')).toBe('C:/Users/test/project');
    });

    it('preserves forward slashes', () => {
      expect(OrchestratorFolders.ToLinuxFolder('/home/user/project')).toBe('/home/user/project');
    });

    it('handles mixed slashes', () => {
      expect(OrchestratorFolders.ToLinuxFolder('some/path\\mixed/slashes\\here')).toBe('some/path/mixed/slashes/here');
    });

    it('handles empty string', () => {
      expect(OrchestratorFolders.ToLinuxFolder('')).toBe('');
    });
  });

  describe('path computations (non-retained workspace mode)', () => {
    it('uniqueOrchestratorJobFolderAbsolute uses buildGuid', () => {
      const result = normalize(OrchestratorFolders.uniqueOrchestratorJobFolderAbsolute);
      expect(result).toBe('/data/test-guid-abc');
    });

    it('cacheFolderForAllFull returns /data/cache', () => {
      const result = normalize(OrchestratorFolders.cacheFolderForAllFull);
      expect(result).toBe('/data/cache');
    });

    it('cacheFolderForCacheKeyFull includes cache key', () => {
      const result = normalize(OrchestratorFolders.cacheFolderForCacheKeyFull);
      expect(result).toBe('/data/cache/my-cache-key');
    });

    it('repoPathAbsolute is under job folder', () => {
      const result = normalize(OrchestratorFolders.repoPathAbsolute);
      expect(result).toBe('/data/test-guid-abc/repo');
    });

    it('projectPathAbsolute includes project path', () => {
      const result = normalize(OrchestratorFolders.projectPathAbsolute);
      expect(result).toBe('/data/test-guid-abc/repo/test-project');
    });

    it('libraryFolderAbsolute is under project path', () => {
      const result = normalize(OrchestratorFolders.libraryFolderAbsolute);
      expect(result).toBe('/data/test-guid-abc/repo/test-project/Library');
    });

    it('projectBuildFolderAbsolute uses buildPath', () => {
      const result = normalize(OrchestratorFolders.projectBuildFolderAbsolute);
      expect(result).toBe('/data/test-guid-abc/repo/Builds');
    });

    it('lfsFolderAbsolute is under .git/lfs', () => {
      const result = normalize(OrchestratorFolders.lfsFolderAbsolute);
      expect(result).toBe('/data/test-guid-abc/repo/.git/lfs');
    });

    it('lfsCacheFolderFull is under cache key', () => {
      const result = normalize(OrchestratorFolders.lfsCacheFolderFull);
      expect(result).toBe('/data/cache/my-cache-key/lfs');
    });

    it('libraryCacheFolderFull is under cache key', () => {
      const result = normalize(OrchestratorFolders.libraryCacheFolderFull);
      expect(result).toBe('/data/cache/my-cache-key/Library');
    });
  });

  describe('builderPathAbsolute', () => {
    it('uses job folder when shared builder is disabled', () => {
      const result = normalize(OrchestratorFolders.builderPathAbsolute);
      expect(result).toBe('/data/test-guid-abc/builder');
    });
  });

  describe('repo URLs', () => {
    it('unityBuilderRepoUrl includes token and repo name', () => {
      const url = OrchestratorFolders.unityBuilderRepoUrl;
      expect(url).toBe('https://ghp_test123@github.com/game-ci/unity-builder.git');
    });

    it('targetBuildRepoUrl includes token and github repo', () => {
      const url = OrchestratorFolders.targetBuildRepoUrl;
      expect(url).toBe('https://ghp_test123@github.com/user/my-game.git');
    });
  });

  describe('purgeRemoteCaching', () => {
    it('returns false when env var is not set', () => {
      const original = process.env.PURGE_REMOTE_BUILDER_CACHE;
      delete process.env.PURGE_REMOTE_BUILDER_CACHE;
      expect(OrchestratorFolders.purgeRemoteCaching).toBe(false);
      if (original !== undefined) process.env.PURGE_REMOTE_BUILDER_CACHE = original;
    });

    it('returns true when env var is set', () => {
      const original = process.env.PURGE_REMOTE_BUILDER_CACHE;
      process.env.PURGE_REMOTE_BUILDER_CACHE = 'true';
      expect(OrchestratorFolders.purgeRemoteCaching).toBe(true);
      if (original !== undefined) {
        process.env.PURGE_REMOTE_BUILDER_CACHE = original;
      } else {
        delete process.env.PURGE_REMOTE_BUILDER_CACHE;
      }
    });
  });
});
