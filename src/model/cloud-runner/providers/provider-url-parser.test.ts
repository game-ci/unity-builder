import { parseProviderSource, generateCacheKey, isGitHubSource } from './provider-url-parser';

describe('provider-url-parser', () => {
  describe('parseProviderSource', () => {
    it('parses HTTPS GitHub URLs correctly', () => {
      const result = parseProviderSource('https://github.com/user/repo');
      expect(result).toEqual({
        type: 'github',
        owner: 'user',
        repo: 'repo',
        branch: 'main',
        path: '',
        url: 'https://github.com/user/repo',
      });
    });

    it('parses HTTPS GitHub URLs with branch', () => {
      const result = parseProviderSource('https://github.com/user/repo/tree/develop');
      expect(result).toEqual({
        type: 'github',
        owner: 'user',
        repo: 'repo',
        branch: 'develop',
        path: '',
        url: 'https://github.com/user/repo',
      });
    });

    it('parses HTTPS GitHub URLs with path', () => {
      const result = parseProviderSource('https://github.com/user/repo/tree/main/src/providers');
      expect(result).toEqual({
        type: 'github',
        owner: 'user',
        repo: 'repo',
        branch: 'main',
        path: 'src/providers',
        url: 'https://github.com/user/repo',
      });
    });

    it('parses GitHub URLs with .git extension', () => {
      const result = parseProviderSource('https://github.com/user/repo.git');
      expect(result).toEqual({
        type: 'github',
        owner: 'user',
        repo: 'repo',
        branch: 'main',
        path: '',
        url: 'https://github.com/user/repo',
      });
    });

    it('parses SSH GitHub URLs', () => {
      const result = parseProviderSource('git@github.com:user/repo.git');
      expect(result).toEqual({
        type: 'github',
        owner: 'user',
        repo: 'repo',
        branch: 'main',
        path: '',
        url: 'https://github.com/user/repo',
      });
    });

    it('parses shorthand GitHub references', () => {
      const result = parseProviderSource('user/repo');
      expect(result).toEqual({
        type: 'github',
        owner: 'user',
        repo: 'repo',
        branch: 'main',
        path: '',
        url: 'https://github.com/user/repo',
      });
    });

    it('parses shorthand GitHub references with branch', () => {
      const result = parseProviderSource('user/repo@develop');
      expect(result).toEqual({
        type: 'github',
        owner: 'user',
        repo: 'repo',
        branch: 'develop',
        path: '',
        url: 'https://github.com/user/repo',
      });
    });

    it('parses shorthand GitHub references with path', () => {
      const result = parseProviderSource('user/repo@main/src/providers');
      expect(result).toEqual({
        type: 'github',
        owner: 'user',
        repo: 'repo',
        branch: 'main',
        path: 'src/providers',
        url: 'https://github.com/user/repo',
      });
    });

    it('parses local relative paths', () => {
      const result = parseProviderSource('./my-provider');
      expect(result).toEqual({
        type: 'local',
        path: './my-provider',
      });
    });

    it('parses local absolute paths', () => {
      const result = parseProviderSource('/path/to/provider');
      expect(result).toEqual({
        type: 'local',
        path: '/path/to/provider',
      });
    });

    it('parses Windows paths', () => {
      const result = parseProviderSource('C:\\path\\to\\provider');
      expect(result).toEqual({
        type: 'local',
        path: 'C:\\path\\to\\provider',
      });
    });

    it('parses NPM package names', () => {
      const result = parseProviderSource('my-provider-package');
      expect(result).toEqual({
        type: 'npm',
        packageName: 'my-provider-package',
      });
    });

    it('parses scoped NPM package names', () => {
      const result = parseProviderSource('@scope/my-provider');
      expect(result).toEqual({
        type: 'npm',
        packageName: '@scope/my-provider',
      });
    });
  });

  describe('generateCacheKey', () => {
    it('generates valid cache keys for GitHub URLs', () => {
      const urlInfo = {
        type: 'github' as const,
        owner: 'user',
        repo: 'my-repo',
        branch: 'develop',
        url: 'https://github.com/user/my-repo',
      };

      const key = generateCacheKey(urlInfo);
      expect(key).toBe('github_user_my-repo_develop');
    });

    it('handles special characters in cache keys', () => {
      const urlInfo = {
        type: 'github' as const,
        owner: 'user-name',
        repo: 'my.repo',
        branch: 'feature/branch',
        url: 'https://github.com/user-name/my.repo',
      };

      const key = generateCacheKey(urlInfo);
      expect(key).toBe('github_user-name_my_repo_feature_branch');
    });
  });

  describe('isGitHubSource', () => {
    it('identifies GitHub URLs correctly', () => {
      expect(isGitHubSource('https://github.com/user/repo')).toBe(true);
      expect(isGitHubSource('git@github.com:user/repo.git')).toBe(true);
      expect(isGitHubSource('user/repo')).toBe(true);
      expect(isGitHubSource('user/repo@develop')).toBe(true);
    });

    it('identifies non-GitHub sources correctly', () => {
      expect(isGitHubSource('./local-provider')).toBe(false);
      expect(isGitHubSource('/absolute/path')).toBe(false);
      expect(isGitHubSource('npm-package')).toBe(false);
      expect(isGitHubSource('@scope/package')).toBe(false);
    });
  });
});
