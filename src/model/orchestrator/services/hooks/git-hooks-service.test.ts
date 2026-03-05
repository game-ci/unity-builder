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

  describe('detectUnityGitHooks', () => {
    it('should return true when package is in manifest.json', () => {
      (mockFs.existsSync as jest.Mock).mockReturnValue(true);
      (mockFs.readFileSync as jest.Mock).mockReturnValue(JSON.stringify({
        dependencies: {
          'com.frostebite.unitygithooks': 'https://github.com/frostebite/UnityGitHooks.git#1.0.5',
        },
      }));

      expect(GitHooksService.detectUnityGitHooks('/repo')).toBe(true);
    });

    it('should return false when package is not in manifest.json', () => {
      (mockFs.existsSync as jest.Mock).mockReturnValue(true);
      (mockFs.readFileSync as jest.Mock).mockReturnValue(JSON.stringify({
        dependencies: {
          'com.unity.textmeshpro': '3.0.6',
        },
      }));

      expect(GitHooksService.detectUnityGitHooks('/repo')).toBe(false);
    });

    it('should return false when manifest.json does not exist', () => {
      (mockFs.existsSync as jest.Mock).mockReturnValue(false);

      expect(GitHooksService.detectUnityGitHooks('/repo')).toBe(false);
    });

    it('should return false on read error', () => {
      (mockFs.existsSync as jest.Mock).mockReturnValue(true);
      (mockFs.readFileSync as jest.Mock).mockImplementation(() => {
        throw new Error('Permission denied');
      });

      expect(GitHooksService.detectUnityGitHooks('/repo')).toBe(false);
    });
  });

  describe('findUnityGitHooksPackagePath', () => {
    it('should find versioned package directory', () => {
      (mockFs.existsSync as jest.Mock).mockReturnValue(true);
      (mockFs.readdirSync as jest.Mock).mockReturnValue([
        'com.unity.textmeshpro@3.0.6',
        'com.frostebite.unitygithooks@1.0.5',
        'com.unity.ugui@1.0.0',
      ]);

      const result = GitHooksService.findUnityGitHooksPackagePath('/repo');
      expect(result).toContain('com.frostebite.unitygithooks@1.0.5');
    });

    it('should return empty string when package not in cache', () => {
      (mockFs.existsSync as jest.Mock).mockReturnValue(true);
      (mockFs.readdirSync as jest.Mock).mockReturnValue([
        'com.unity.textmeshpro@3.0.6',
      ]);

      const result = GitHooksService.findUnityGitHooksPackagePath('/repo');
      expect(result).toBe('');
    });

    it('should return empty string when PackageCache does not exist', () => {
      (mockFs.existsSync as jest.Mock).mockReturnValue(false);

      const result = GitHooksService.findUnityGitHooksPackagePath('/repo');
      expect(result).toBe('');
    });
  });

  describe('initUnityGitHooks', () => {
    it('should run the init script when found', async () => {
      const { OrchestratorSystem } = require('../core/orchestrator-system');

      (mockFs.existsSync as jest.Mock).mockReturnValue(true);
      (mockFs.readdirSync as jest.Mock).mockReturnValue([
        'com.frostebite.unitygithooks@1.0.5',
      ]);

      await GitHooksService.initUnityGitHooks('/repo');

      expect(OrchestratorSystem.Run).toHaveBeenCalledWith(
        expect.stringContaining('init-unity-lefthook.js'),
        true,
      );
    });

    it('should skip when package not found in cache', async () => {
      const { OrchestratorSystem } = require('../core/orchestrator-system');

      (mockFs.existsSync as jest.Mock).mockReturnValue(false);

      await GitHooksService.initUnityGitHooks('/repo');

      expect(OrchestratorSystem.Run).not.toHaveBeenCalled();
    });

    it('should warn when init script does not exist', async () => {
      const OrchestratorLogger = require('../core/orchestrator-logger').default;

      (mockFs.existsSync as jest.Mock).mockImplementation((p: string) => {
        // PackageCache dir exists, but init script doesn't
        return !String(p).includes('init-unity-lefthook');
      });
      (mockFs.readdirSync as jest.Mock).mockReturnValue([
        'com.frostebite.unitygithooks@1.0.5',
      ]);

      await GitHooksService.initUnityGitHooks('/repo');

      expect(OrchestratorLogger.logWarning).toHaveBeenCalledWith(
        expect.stringContaining('init script not found'),
      );
    });

    it('should log warning on init failure', async () => {
      const { OrchestratorSystem } = require('../core/orchestrator-system');
      const OrchestratorLogger = require('../core/orchestrator-logger').default;

      (mockFs.existsSync as jest.Mock).mockReturnValue(true);
      (mockFs.readdirSync as jest.Mock).mockReturnValue([
        'com.frostebite.unitygithooks@1.0.5',
      ]);
      OrchestratorSystem.Run.mockRejectedValue(new Error('node not found'));

      await GitHooksService.initUnityGitHooks('/repo');

      expect(OrchestratorLogger.logWarning).toHaveBeenCalledWith(
        expect.stringContaining('init failed'),
      );
    });
  });

  describe('configureUnityGitHooksCIEnv', () => {
    it('should disable background project mode', () => {
      const env = GitHooksService.configureUnityGitHooksCIEnv();
      expect(env.UNITY_GITHOOKS_BACKGROUND_PROJECT_ENABLED).toBe('false');
    });

    it('should set CI=true', () => {
      const env = GitHooksService.configureUnityGitHooksCIEnv();
      expect(env.CI).toBe('true');
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

    it('should init Unity Git Hooks before installing lefthook when detected', async () => {
      const { OrchestratorSystem } = require('../core/orchestrator-system');
      const OrchestratorLogger = require('../core/orchestrator-logger').default;
      const callOrder: string[] = [];

      (mockFs.existsSync as jest.Mock).mockReturnValue(true);
      (mockFs.readFileSync as jest.Mock).mockReturnValue(
        `{"dependencies":{"com.frostebite.unitygithooks":"https://github.com/frostebite/UnityGitHooks.git"}}`,
      );
      (mockFs.readdirSync as jest.Mock).mockReturnValue([
        'com.frostebite.unitygithooks@1.0.5',
      ]);

      OrchestratorSystem.Run.mockImplementation((cmd: string) => {
        if (cmd.includes('init-unity-lefthook')) {
          callOrder.push('init');
        } else if (cmd.includes('lefthook install')) {
          callOrder.push('install');
        }

        return Promise.resolve('');
      });

      await GitHooksService.installHooks('/repo');

      // Init should happen before install
      expect(callOrder).toEqual(['init', 'install']);
      expect(OrchestratorLogger.log).toHaveBeenCalledWith(
        expect.stringContaining('Unity Git Hooks (UPM) detected'),
      );
    });

    it('should set CI env vars when Unity Git Hooks detected', async () => {
      (mockFs.existsSync as jest.Mock).mockReturnValue(true);
      (mockFs.readFileSync as jest.Mock).mockReturnValue(
        `{"dependencies":{"com.frostebite.unitygithooks":"1.0.5"}}`,
      );
      (mockFs.readdirSync as jest.Mock).mockReturnValue([
        'com.frostebite.unitygithooks@1.0.5',
      ]);

      await GitHooksService.installHooks('/repo');

      expect(process.env.UNITY_GITHOOKS_BACKGROUND_PROJECT_ENABLED).toBe('false');
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

  describe('runHookGroups', () => {
    it('should run each group via lefthook run', async () => {
      const { OrchestratorSystem } = require('../core/orchestrator-system');
      (mockFs.existsSync as jest.Mock).mockImplementation((filePath: string) => {
        return String(filePath).includes('lefthook.yml') && !String(filePath).startsWith('.');
      });
      OrchestratorSystem.Run.mockResolvedValue('');

      const results = await GitHooksService.runHookGroups('/repo', ['pre-commit', 'pre-push']);

      expect(OrchestratorSystem.Run).toHaveBeenCalledWith(
        `cd "/repo" && npx lefthook run pre-commit`,
        true,
      );
      expect(OrchestratorSystem.Run).toHaveBeenCalledWith(
        `cd "/repo" && npx lefthook run pre-push`,
        true,
      );
      expect(results['pre-commit']).toBe(true);
      expect(results['pre-push']).toBe(true);
    });

    it('should return empty results for empty groups', async () => {
      const results = await GitHooksService.runHookGroups('/repo', []);
      expect(results).toEqual({});
    });

    it('should warn and return empty if not using lefthook', async () => {
      (mockFs.existsSync as jest.Mock).mockReturnValue(false);
      const OrchestratorLogger = require('../core/orchestrator-logger').default;

      const results = await GitHooksService.runHookGroups('/repo', ['pre-commit']);

      expect(results).toEqual({});
      expect(OrchestratorLogger.logWarning).toHaveBeenCalledWith(
        expect.stringContaining('requires lefthook'),
      );
    });

    it('should mark failed groups as false', async () => {
      const { OrchestratorSystem } = require('../core/orchestrator-system');
      (mockFs.existsSync as jest.Mock).mockImplementation((filePath: string) => {
        return String(filePath).includes('lefthook.yml') && !String(filePath).startsWith('.');
      });

      OrchestratorSystem.Run
        .mockResolvedValueOnce('') // pre-commit passes
        .mockRejectedValueOnce(new Error('tests failed')); // pre-push fails

      const results = await GitHooksService.runHookGroups('/repo', ['pre-commit', 'pre-push']);

      expect(results['pre-commit']).toBe(true);
      expect(results['pre-push']).toBe(false);
    });

    it('should log each group result', async () => {
      const { OrchestratorSystem } = require('../core/orchestrator-system');
      const OrchestratorLogger = require('../core/orchestrator-logger').default;
      (mockFs.existsSync as jest.Mock).mockImplementation((filePath: string) => {
        return String(filePath).includes('lefthook.yml') && !String(filePath).startsWith('.');
      });

      OrchestratorSystem.Run
        .mockResolvedValueOnce('')
        .mockRejectedValueOnce(new Error('check failed'));

      await GitHooksService.runHookGroups('/repo', ['pre-commit', 'commit-msg']);

      expect(OrchestratorLogger.log).toHaveBeenCalledWith(
        expect.stringContaining("'pre-commit' passed"),
      );
      expect(OrchestratorLogger.logWarning).toHaveBeenCalledWith(
        expect.stringContaining("'commit-msg' failed"),
      );
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

    it('should handle single hook in skip list', () => {
      const result = GitHooksService.configureSkipList(['commit-msg']);
      expect(result.LEFTHOOK_EXCLUDE).toBe('commit-msg');
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

  describe('constants', () => {
    it('should have correct package name', () => {
      expect(GitHooksService.UNITY_GIT_HOOKS_PACKAGE).toBe('com.frostebite.unitygithooks');
    });
  });
});
