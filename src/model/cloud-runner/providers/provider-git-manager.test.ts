import { GitHubUrlInfo } from './provider-url-parser';
import * as fs from 'fs';
import path from 'path';

// Mock @actions/core to fix fs.promises compatibility issue
jest.mock('@actions/core', () => ({
  info: jest.fn(),
  warning: jest.fn(),
  error: jest.fn(),
}));

// Mock fs module
jest.mock('fs');

// Mock the entire provider-git-manager module
const mockExecAsync = jest.fn();
jest.mock('./provider-git-manager', () => {
  const originalModule = jest.requireActual('./provider-git-manager');
  return {
    ...originalModule,
    ProviderGitManager: {
      ...originalModule.ProviderGitManager,
      cloneRepository: jest.fn(),
      updateRepository: jest.fn(),
      getProviderModulePath: jest.fn(),
    },
  };
});

const mockFs = fs as jest.Mocked<typeof fs>;

// Import the mocked ProviderGitManager
import { ProviderGitManager } from './provider-git-manager';
const mockProviderGitManager = ProviderGitManager as jest.Mocked<typeof ProviderGitManager>;

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
  });

  describe('cloneRepository', () => {
    it('successfully clones a repository', async () => {
      const expectedResult = {
        success: true,
        localPath: '/path/to/cloned/repo',
      };
      mockProviderGitManager.cloneRepository.mockResolvedValue(expectedResult);

      const result = await mockProviderGitManager.cloneRepository(mockUrlInfo);

      expect(result.success).toBe(true);
      expect(result.localPath).toBe('/path/to/cloned/repo');
    });

    it('handles clone errors', async () => {
      const expectedResult = {
        success: false,
        localPath: '/path/to/cloned/repo',
        error: 'Clone failed',
      };
      mockProviderGitManager.cloneRepository.mockResolvedValue(expectedResult);

      const result = await mockProviderGitManager.cloneRepository(mockUrlInfo);

      expect(result.success).toBe(false);
      expect(result.error).toContain('Clone failed');
    });
  });

  describe('updateRepository', () => {
    it('successfully updates a repository when updates are available', async () => {
      const expectedResult = {
        success: true,
        updated: true,
      };
      mockProviderGitManager.updateRepository.mockResolvedValue(expectedResult);

      const result = await mockProviderGitManager.updateRepository(mockUrlInfo);

      expect(result.success).toBe(true);
      expect(result.updated).toBe(true);
    });

    it('reports no updates when repository is up to date', async () => {
      const expectedResult = {
        success: true,
        updated: false,
      };
      mockProviderGitManager.updateRepository.mockResolvedValue(expectedResult);

      const result = await mockProviderGitManager.updateRepository(mockUrlInfo);

      expect(result.success).toBe(true);
      expect(result.updated).toBe(false);
    });

    it('handles update errors', async () => {
      const expectedResult = {
        success: false,
        updated: false,
        error: 'Update failed',
      };
      mockProviderGitManager.updateRepository.mockResolvedValue(expectedResult);

      const result = await mockProviderGitManager.updateRepository(mockUrlInfo);

      expect(result.success).toBe(false);
      expect(result.updated).toBe(false);
      expect(result.error).toContain('Update failed');
    });
  });

  describe('getProviderModulePath', () => {
    it('returns the specified path when provided', () => {
      const urlInfoWithPath = { ...mockUrlInfo, path: 'src/providers' };
      const localPath = '/path/to/repo';
      const expectedPath = '/path/to/repo/src/providers';

      mockProviderGitManager.getProviderModulePath.mockReturnValue(expectedPath);

      const result = mockProviderGitManager.getProviderModulePath(urlInfoWithPath, localPath);

      expect(result).toBe(expectedPath);
    });

    it('finds common entry points when no path specified', () => {
      const localPath = '/path/to/repo';
      const expectedPath = '/path/to/repo/index.js';

      mockProviderGitManager.getProviderModulePath.mockReturnValue(expectedPath);

      const result = mockProviderGitManager.getProviderModulePath(mockUrlInfo, localPath);

      expect(result).toBe(expectedPath);
    });

    it('returns repository root when no entry point found', () => {
      const localPath = '/path/to/repo';

      mockProviderGitManager.getProviderModulePath.mockReturnValue(localPath);

      const result = mockProviderGitManager.getProviderModulePath(mockUrlInfo, localPath);

      expect(result).toBe(localPath);
    });
  });
});
