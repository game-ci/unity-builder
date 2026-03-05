import fs from 'node:fs';
import path from 'node:path';
import { GitHooksService } from './git-hooks-service';

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

describe('GitHooksService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('detectHookFramework', () => {
    it('should detect lefthook.yml', () => {
      (mockFs.existsSync as jest.Mock).mockImplementation((filePath: string) => {
        return String(filePath).includes('lefthook.yml') && !String(filePath).startsWith('.');
      });

      const result = GitHooksService.detectHookFramework('/repo');
      expect(result).toBe('lefthook');
    });

    it('should detect .lefthook.yml', () => {
      (mockFs.existsSync as jest.Mock).mockImplementation((filePath: string) => {
        return String(filePath).includes('.lefthook.yml');
      });

      const result = GitHooksService.detectHookFramework('/repo');
      expect(result).toBe('lefthook');
    });

    it('should detect .husky directory', () => {
      (mockFs.existsSync as jest.Mock).mockImplementation((filePath: string) => {
        return String(filePath).endsWith('.husky');
      });

      const result = GitHooksService.detectHookFramework('/repo');
      expect(result).toBe('husky');
    });

    it('should return none when no framework is detected', () => {
      (mockFs.existsSync as jest.Mock).mockReturnValue(false);

      const result = GitHooksService.detectHookFramework('/repo');
      expect(result).toBe('none');
    });
  });

  describe('configureSkipList', () => {
    it('should return empty object for empty skip list', () => {
      const result = GitHooksService.configureSkipList([]);
      expect(result).toEqual({});
    });

    it('should return LEFTHOOK_EXCLUDE with comma-separated hooks', () => {
      const result = GitHooksService.configureSkipList(['pre-commit', 'pre-push']);
      expect(result.LEFTHOOK_EXCLUDE).toBe('pre-commit,pre-push');
    });

    it('should set HUSKY=0 when hooks are skipped', () => {
      const result = GitHooksService.configureSkipList(['pre-commit']);
      expect(result.HUSKY).toBe('0');
    });
  });

  describe('disableHooks', () => {
    it('should set core.hooksPath to an empty directory', async () => {
      (mockFs.mkdirSync as jest.Mock).mockReturnValue(undefined);

      const { OrchestratorSystem } = require('../core/orchestrator-system');

      await GitHooksService.disableHooks('/repo');

      expect(OrchestratorSystem.Run).toHaveBeenCalledWith(
        expect.stringContaining('git -C "/repo" config core.hooksPath'),
        true,
      );
    });
  });

  describe('installHooks', () => {
    it('should run npx lefthook install when lefthook is detected', async () => {
      (mockFs.existsSync as jest.Mock).mockImplementation((filePath: string) => {
        return String(filePath).includes('lefthook.yml') && !String(filePath).startsWith('.');
      });

      const { OrchestratorSystem } = require('../core/orchestrator-system');

      await GitHooksService.installHooks('/repo');

      expect(OrchestratorSystem.Run).toHaveBeenCalledWith(`cd "/repo" && npx lefthook install`, true);
    });

    it('should run npx husky install when husky is detected', async () => {
      (mockFs.existsSync as jest.Mock).mockImplementation((filePath: string) => {
        return String(filePath).endsWith('.husky');
      });

      const { OrchestratorSystem } = require('../core/orchestrator-system');

      await GitHooksService.installHooks('/repo');

      expect(OrchestratorSystem.Run).toHaveBeenCalledWith(`cd "/repo" && npx husky install`, true);
    });

    it('should log and return when no framework is detected', async () => {
      (mockFs.existsSync as jest.Mock).mockReturnValue(false);

      const { OrchestratorSystem } = require('../core/orchestrator-system');
      const OrchestratorLogger = require('../core/orchestrator-logger').default;

      await GitHooksService.installHooks('/repo');

      expect(OrchestratorSystem.Run).not.toHaveBeenCalled();
      expect(OrchestratorLogger.log).toHaveBeenCalledWith(expect.stringContaining('No hook framework detected'));
    });

    it('should log warning on installation failure', async () => {
      (mockFs.existsSync as jest.Mock).mockImplementation((filePath: string) => {
        return String(filePath).includes('lefthook.yml') && !String(filePath).startsWith('.');
      });

      const { OrchestratorSystem } = require('../core/orchestrator-system');
      const OrchestratorLogger = require('../core/orchestrator-logger').default;
      OrchestratorSystem.Run.mockRejectedValue(new Error('npx not found'));

      await GitHooksService.installHooks('/repo');

      expect(OrchestratorLogger.logWarning).toHaveBeenCalledWith(
        expect.stringContaining('Hook installation failed'),
      );
    });
  });

  describe('disableHooks', () => {
    it('should log warning on failure to disable hooks', async () => {
      (mockFs.mkdirSync as jest.Mock).mockReturnValue(undefined);

      const { OrchestratorSystem } = require('../core/orchestrator-system');
      const OrchestratorLogger = require('../core/orchestrator-logger').default;
      OrchestratorSystem.Run.mockRejectedValue(new Error('git config failed'));

      await GitHooksService.disableHooks('/repo');

      expect(OrchestratorLogger.logWarning).toHaveBeenCalledWith(
        expect.stringContaining('Failed to disable hooks'),
      );
    });
  });

  describe('configureSkipList edge cases', () => {
    it('should handle single hook in skip list', () => {
      const result = GitHooksService.configureSkipList(['commit-msg']);
      expect(result.LEFTHOOK_EXCLUDE).toBe('commit-msg');
      expect(result.HUSKY).toBe('0');
    });
  });
});
