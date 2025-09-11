import { ProviderGitManager } from './provider-git-manager';
import { GitHubUrlInfo } from './provider-url-parser';
import * as fs from 'fs';
import path from 'path';
import { exec } from 'child_process';

// Mock the exec function
jest.mock('child_process', () => ({
  exec: jest.fn(),
}));

// Mock fs module
jest.mock('fs');

const mockFs = fs as jest.Mocked<typeof fs>;
const mockExec = exec as jest.MockedFunction<typeof exec>;

describe('ProviderGitManager', () => {
  const mockUrlInfo: GitHubUrlInfo = {
    type: 'github',
    owner: 'test-user',
    repo: 'test-repo',
    branch: 'main',
    url: 'https://github.com/test-user/test-repo',
  };

  beforeEach(() => {
    jest.clearAllMocks();
    mockExec.mockImplementation((command, options, callback) => {
      if (callback) {
        callback(undefined as any, 'success', '');
      }

      return { stdout: 'success', stderr: '' } as any;
    });
  });

  describe('isRepositoryCloned', () => {
    it('returns true when repository exists', () => {
      const localPath = ProviderGitManager['getLocalPath'](mockUrlInfo);
      mockFs.existsSync.mockReturnValue(true);

      const result = ProviderGitManager['isRepositoryCloned'](mockUrlInfo);
      expect(result).toBe(true);
      expect(mockFs.existsSync).toHaveBeenCalledWith(localPath);
      expect(mockFs.existsSync).toHaveBeenCalledWith(path.join(localPath, '.git'));
    });

    it('returns false when repository does not exist', () => {
      mockFs.existsSync.mockReturnValue(false);

      const result = ProviderGitManager['isRepositoryCloned'](mockUrlInfo);
      expect(result).toBe(false);
    });
  });

  describe('cloneRepository', () => {
    it('successfully clones a repository', async () => {
      mockFs.existsSync.mockReturnValue(false);
      mockFs.mkdirSync.mockImplementation(() => '');
      mockFs.rmSync.mockImplementation(() => {});

      const result = await ProviderGitManager.cloneRepository(mockUrlInfo);

      expect(result.success).toBe(true);
      expect(result.localPath).toContain('github_test-user_test-repo_main');
      expect(mockExec).toHaveBeenCalledWith(
        expect.stringContaining('git clone'),
        expect.objectContaining({
          timeout: 30000,
          cwd: expect.any(String),
        }),
      );
    });

    it('handles clone errors', async () => {
      mockFs.existsSync.mockReturnValue(false);
      mockFs.mkdirSync.mockImplementation(() => '');
      mockFs.rmSync.mockImplementation(() => {});

      mockExec.mockImplementation((command, options, callback) => {
        if (callback) {
          callback(new Error('Clone failed'), '', 'error');
        }

        return { stdout: '', stderr: 'error' } as any;
      });

      const result = await ProviderGitManager.cloneRepository(mockUrlInfo);

      expect(result.success).toBe(false);
      expect(result.error).toContain('Clone failed');
    });
  });

  describe('updateRepository', () => {
    it('successfully updates a repository when updates are available', async () => {
      mockFs.existsSync.mockReturnValue(true);

      // Mock git status output indicating updates are available
      mockExec.mockImplementation((command, options, callback) => {
        if (command.includes('git status')) {
          if (callback) {
            callback(undefined as any, 'Your branch is behind', '');
          }

          return { stdout: 'Your branch is behind', stderr: '' } as any;
        } else if (command.includes('git reset')) {
          if (callback) {
            callback(undefined as any, 'success', '');
          }

          return { stdout: 'success', stderr: '' } as any;
        } else if (command.includes('git fetch')) {
          if (callback) {
            callback(undefined as any, 'success', '');
          }

          return { stdout: 'success', stderr: '' } as any;
        }
        if (callback) {
          callback(undefined as any, 'success', '');
        }

        return { stdout: 'success', stderr: '' } as any;
      });

      const result = await ProviderGitManager.updateRepository(mockUrlInfo);

      expect(result.success).toBe(true);
      expect(result.updated).toBe(true);
    });

    it('reports no updates when repository is up to date', async () => {
      mockFs.existsSync.mockReturnValue(true);

      // Mock git status output indicating no updates
      mockExec.mockImplementation((command, options, callback) => {
        if (command.includes('git status')) {
          if (callback) {
            callback(undefined as any, 'Your branch is up to date', '');
          }

          return { stdout: 'Your branch is up to date', stderr: '' } as any;
        } else if (command.includes('git fetch')) {
          if (callback) {
            callback(undefined as any, 'success', '');
          }

          return { stdout: 'success', stderr: '' } as any;
        }
        if (callback) {
          callback(undefined as any, 'success', '');
        }

        return { stdout: 'success', stderr: '' } as any;
      });

      const result = await ProviderGitManager.updateRepository(mockUrlInfo);

      expect(result.success).toBe(true);
      expect(result.updated).toBe(false);
    });

    it('handles update errors', async () => {
      mockFs.existsSync.mockReturnValue(true);

      mockExec.mockImplementation((command, options, callback) => {
        if (callback) {
          callback(new Error('Update failed'), '', 'error');
        }

        return { stdout: '', stderr: 'error' } as any;
      });

      const result = await ProviderGitManager.updateRepository(mockUrlInfo);

      expect(result.success).toBe(false);
      expect(result.error).toContain('Update failed');
    });
  });

  describe('getProviderModulePath', () => {
    it('returns the specified path when provided', () => {
      const urlInfoWithPath = { ...mockUrlInfo, path: 'src/providers' };
      const localPath = '/path/to/repo';

      const result = ProviderGitManager.getProviderModulePath(urlInfoWithPath, localPath);

      expect(result).toBe(path.join(localPath, 'src/providers'));
    });

    it('finds common entry points when no path specified', () => {
      const localPath = '/path/to/repo';
      mockFs.existsSync.mockImplementation((filePath) => {
        return filePath === path.join(localPath, 'index.js');
      });

      const result = ProviderGitManager.getProviderModulePath(mockUrlInfo, localPath);

      expect(result).toBe(path.join(localPath, 'index.js'));
    });

    it('returns repository root when no entry point found', () => {
      const localPath = '/path/to/repo';
      mockFs.existsSync.mockReturnValue(false);

      const result = ProviderGitManager.getProviderModulePath(mockUrlInfo, localPath);

      expect(result).toBe(localPath);
    });
  });
});
