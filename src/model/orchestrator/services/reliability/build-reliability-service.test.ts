import fs from 'node:fs';
import { BuildReliabilityService } from './build-reliability-service';

// Mock dependencies
jest.mock('node:fs');
jest.mock('../core/orchestrator-logger');
jest.mock('../core/orchestrator-system');

const mockFs = fs as jest.Mocked<typeof fs>;

describe('BuildReliabilityService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('cleanStaleLockFiles', () => {
    it('should return 0 when .git directory does not exist', async () => {
      mockFs.existsSync.mockReturnValue(false);
      const result = await BuildReliabilityService.cleanStaleLockFiles('/repo');
      expect(result).toBe(0);
    });
  });

  describe('cleanReservedFilenames', () => {
    it('should return empty array when Assets directory does not exist', async () => {
      mockFs.existsSync.mockReturnValue(false);
      const result = await BuildReliabilityService.cleanReservedFilenames('/project');
      expect(result).toEqual([]);
    });
  });

  describe('validateSubmoduleBackingStores', () => {
    it('should return empty array when .gitmodules does not exist', async () => {
      mockFs.existsSync.mockReturnValue(false);
      const result = await BuildReliabilityService.validateSubmoduleBackingStores('/repo');
      expect(result).toEqual([]);
    });
  });

  describe('enforceRetention', () => {
    it('should return 0 when archive path does not exist', async () => {
      mockFs.existsSync.mockReturnValue(false);
      const result = await BuildReliabilityService.enforceRetention('/archive', 3);
      expect(result).toBe(0);
    });
  });

  describe('configureGitEnvironment', () => {
    it('should return GIT_CONFIG_NOSYSTEM=1', () => {
      const environment = BuildReliabilityService.configureGitEnvironment();
      expect(environment.GIT_CONFIG_NOSYSTEM).toBe('1');
    });
  });
});
