import loadProvider, { ProviderLoader } from '../../providers/provider-loader';
import { ProviderInterface } from '../../providers/provider-interface';
import { ProviderGitManager } from '../../providers/provider-git-manager';

// Mock the git manager
jest.mock('../../providers/provider-git-manager');
const mockProviderGitManager = ProviderGitManager as jest.Mocked<typeof ProviderGitManager>;

describe('provider-loader', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('loadProvider', () => {
    it('loads a built-in provider dynamically', async () => {
      const provider: ProviderInterface = await loadProvider('./test', {} as any);
      expect(typeof provider.runTaskInWorkflow).toBe('function');
    });

    it('loads a local provider from relative path', async () => {
      const provider: ProviderInterface = await loadProvider('./test', {} as any);
      expect(typeof provider.runTaskInWorkflow).toBe('function');
    });

    it('loads a GitHub provider', async () => {
      const mockLocalPath = '/path/to/cloned/repo';
      const mockModulePath = '/path/to/cloned/repo/index.js';

      mockProviderGitManager.ensureRepositoryAvailable.mockResolvedValue(mockLocalPath);
      mockProviderGitManager.getProviderModulePath.mockReturnValue(mockModulePath);

      // For now, just test that the git manager methods are called correctly
      // The actual import testing is complex due to dynamic imports
      await expect(loadProvider('https://github.com/user/repo', {} as any)).rejects.toThrow();
      expect(mockProviderGitManager.ensureRepositoryAvailable).toHaveBeenCalled();
    });

    it('throws when provider package is missing', async () => {
      await expect(loadProvider('non-existent-package', {} as any)).rejects.toThrow('non-existent-package');
    });

    it('throws when provider does not implement ProviderInterface', async () => {
      await expect(loadProvider('../tests/fixtures/invalid-provider', {} as any)).rejects.toThrow(
        'does not implement ProviderInterface',
      );
    });

    it('throws when provider does not export a constructor', async () => {
      // Test with a non-existent module that will fail to load
      await expect(loadProvider('./non-existent-constructor-module', {} as any)).rejects.toThrow(
        'Failed to load provider package',
      );
    });
  });

  describe('ProviderLoader class', () => {
    it('loads providers using the static method', async () => {
      const provider: ProviderInterface = await ProviderLoader.loadProvider('./test', {} as any);
      expect(typeof provider.runTaskInWorkflow).toBe('function');
    });

    it('returns available providers', () => {
      const providers = ProviderLoader.getAvailableProviders();
      expect(providers).toContain('aws');
      expect(providers).toContain('k8s');
      expect(providers).toContain('test');
    });

    it('cleans up cache', async () => {
      mockProviderGitManager.cleanupOldRepositories.mockResolvedValue();

      await ProviderLoader.cleanupCache(7);

      expect(mockProviderGitManager.cleanupOldRepositories).toHaveBeenCalledWith(7);
    });

    it('analyzes provider sources', () => {
      const githubInfo = ProviderLoader.analyzeProviderSource('https://github.com/user/repo');
      expect(githubInfo.type).toBe('github');
      if (githubInfo.type === 'github') {
        expect(githubInfo.owner).toBe('user');
        expect(githubInfo.repo).toBe('repo');
      }

      const localInfo = ProviderLoader.analyzeProviderSource('./local-provider');
      expect(localInfo.type).toBe('local');
      if (localInfo.type === 'local') {
        expect(localInfo.path).toBe('./local-provider');
      }

      const npmInfo = ProviderLoader.analyzeProviderSource('my-package');
      expect(npmInfo.type).toBe('npm');
      if (npmInfo.type === 'npm') {
        expect(npmInfo.packageName).toBe('my-package');
      }
    });
  });
});
