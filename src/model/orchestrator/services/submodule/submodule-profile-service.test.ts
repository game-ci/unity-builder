import fs from 'node:fs';
import { SubmoduleProfileService } from './submodule-profile-service';
import { OrchestratorSystem } from '../core/orchestrator-system';

jest.mock('node:fs');
jest.mock('../core/orchestrator-system');
jest.mock('../core/orchestrator-logger', () => ({
  __esModule: true,
  default: {
    log: jest.fn(),
    logWarning: jest.fn(),
    error: jest.fn(),
  },
}));

const mockedFs = fs as jest.Mocked<typeof fs>;
const mockedSystem = OrchestratorSystem as jest.Mocked<typeof OrchestratorSystem>;

describe('SubmoduleProfileService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('parseProfile', () => {
    it('reads and parses a valid YAML profile', () => {
      const profileYaml = `
primary_submodule: Assets/_Game/Submodules/TurnOfWarEndlessCrusade
product_name: Endless Crusade
submodules:
  - name: TurnOfWar
    branch: main
  - name: TurnOfWarEndlessCrusade
    branch: main
  - name: AreaOfOperations
    branch: empty
`;
      mockedFs.existsSync.mockReturnValue(true);
      mockedFs.readFileSync.mockReturnValue(profileYaml);

      const profile = SubmoduleProfileService.parseProfile('/path/to/profile.yml');

      expect(profile.primary_submodule).toBe('Assets/_Game/Submodules/TurnOfWarEndlessCrusade');
      expect(profile.product_name).toBe('Endless Crusade');
      expect(profile.submodules).toHaveLength(3);
      expect(profile.submodules[0]).toEqual({ name: 'TurnOfWar', branch: 'main' });
      expect(profile.submodules[1]).toEqual({ name: 'TurnOfWarEndlessCrusade', branch: 'main' });
      expect(profile.submodules[2]).toEqual({ name: 'AreaOfOperations', branch: 'empty' });
    });

    it('throws if profile file does not exist', () => {
      mockedFs.existsSync.mockReturnValue(false);

      expect(() => SubmoduleProfileService.parseProfile('/missing/profile.yml')).toThrow('Submodule profile not found');
    });

    it('throws if YAML is missing submodules array', () => {
      mockedFs.existsSync.mockReturnValue(true);
      mockedFs.readFileSync.mockReturnValue('product_name: Test\n');

      expect(() => SubmoduleProfileService.parseProfile('/path/to/bad.yml')).toThrow("expected 'submodules' array");
    });
  });

  describe('mergeVariant', () => {
    it('correctly overlays variant entries on base profile', () => {
      const baseYaml = `
submodules:
  - name: ModuleA
    branch: main
  - name: ModuleB
    branch: main
`;
      const variantYaml = `
product_name: Server Build
submodules:
  - name: ModuleB
    branch: empty
  - name: ModuleC
    branch: develop
`;

      mockedFs.existsSync.mockReturnValue(true);
      mockedFs.readFileSync.mockImplementation((filePath: any) => {
        if (filePath === '/base.yml') return baseYaml;
        if (filePath === '/variant.yml') return variantYaml;
        return '';
      });

      const base = SubmoduleProfileService.parseProfile('/base.yml');
      const merged = SubmoduleProfileService.mergeVariant(base, '/variant.yml');

      expect(merged.product_name).toBe('Server Build');
      expect(merged.submodules).toHaveLength(3);

      const moduleA = merged.submodules.find((s) => s.name === 'ModuleA');
      const moduleB = merged.submodules.find((s) => s.name === 'ModuleB');
      const moduleC = merged.submodules.find((s) => s.name === 'ModuleC');

      expect(moduleA?.branch).toBe('main');
      expect(moduleB?.branch).toBe('empty');
      expect(moduleC?.branch).toBe('develop');
    });
  });

  describe('matchSubmodule', () => {
    it('matches exact submodule name', () => {
      expect(SubmoduleProfileService.matchSubmodule('TurnOfWar', 'TurnOfWar')).toBe(true);
    });

    it('matches exact leaf folder name against full path', () => {
      expect(SubmoduleProfileService.matchSubmodule('Assets/_Game/Submodules/TurnOfWar', 'TurnOfWar')).toBe(true);
    });

    it('does not match unrelated names', () => {
      expect(SubmoduleProfileService.matchSubmodule('TurnOfWar', 'AreaOfOperations')).toBe(false);
    });

    it('matches trailing wildcard against full path', () => {
      expect(SubmoduleProfileService.matchSubmodule('Assets/_Engine/Submodules/PluginsFoo', 'Plugins*')).toBe(true);
    });

    it('matches trailing wildcard against full path prefix', () => {
      expect(
        SubmoduleProfileService.matchSubmodule(
          'Assets/_Engine/Submodules/PluginsFoo',
          'Assets/_Engine/Submodules/Plugins*',
        ),
      ).toBe(true);
    });

    it('does not match wildcard that does not align', () => {
      expect(SubmoduleProfileService.matchSubmodule('Assets/_Engine/Submodules/SensorToolkit', 'Plugins*')).toBe(false);
    });
  });

  describe('parseGitmodules', () => {
    it('parses a typical .gitmodules file', () => {
      const gitmodulesContent = `[submodule "Assets/_Game/Submodules/TurnOfWar"]
\tpath = Assets/_Game/Submodules/TurnOfWar
\turl = https://github.com/org/TurnOfWar.git
[submodule "Assets/_Game/Submodules/EndlessCrusade"]
\tpath = Assets/_Game/Submodules/EndlessCrusade
\turl = https://github.com/org/EndlessCrusade.git
[submodule "Assets/_Engine/Submodules/SensorToolkit"]
\tpath = Assets/_Engine/Submodules/SensorToolkit
\turl = https://github.com/org/SensorToolkit.git
`;

      mockedFs.existsSync.mockReturnValue(true);
      mockedFs.readFileSync.mockReturnValue(gitmodulesContent);

      const result = SubmoduleProfileService.parseGitmodules('/repo');

      expect(result.size).toBe(3);
      expect(result.get('Assets/_Game/Submodules/TurnOfWar')).toBe('Assets/_Game/Submodules/TurnOfWar');
      expect(result.get('Assets/_Game/Submodules/EndlessCrusade')).toBe('Assets/_Game/Submodules/EndlessCrusade');
      expect(result.get('Assets/_Engine/Submodules/SensorToolkit')).toBe('Assets/_Engine/Submodules/SensorToolkit');
    });

    it('returns empty map when .gitmodules does not exist', () => {
      mockedFs.existsSync.mockReturnValue(false);

      const result = SubmoduleProfileService.parseGitmodules('/repo');

      expect(result.size).toBe(0);
    });
  });

  describe('createInitPlan', () => {
    it('generates correct init and skip actions', async () => {
      const profileYaml = `
submodules:
  - name: TurnOfWar
    branch: main
  - name: EndlessCrusade
    branch: main
  - name: SensorToolkit
    branch: empty
`;

      const gitmodulesContent = `[submodule "Assets/_Game/Submodules/TurnOfWar"]
\tpath = Assets/_Game/Submodules/TurnOfWar
\turl = https://github.com/org/TurnOfWar.git
[submodule "Assets/_Game/Submodules/EndlessCrusade"]
\tpath = Assets/_Game/Submodules/EndlessCrusade
\turl = https://github.com/org/EndlessCrusade.git
[submodule "Assets/_Engine/Submodules/SensorToolkit"]
\tpath = Assets/_Engine/Submodules/SensorToolkit
\turl = https://github.com/org/SensorToolkit.git
[submodule "Assets/_Game/Submodules/Unmatched"]
\tpath = Assets/_Game/Submodules/Unmatched
\turl = https://github.com/org/Unmatched.git
`;

      mockedFs.existsSync.mockReturnValue(true);
      mockedFs.readFileSync.mockImplementation((filePath: any) => {
        if (String(filePath).endsWith('profile.yml')) return profileYaml;
        if (String(filePath).endsWith('.gitmodules')) return gitmodulesContent;
        return '';
      });

      const plan = await SubmoduleProfileService.createInitPlan('/path/to/profile.yml', '', '/repo');

      expect(plan).toHaveLength(4);

      const turnOfWar = plan.find((a) => a.name === 'Assets/_Game/Submodules/TurnOfWar');
      expect(turnOfWar?.action).toBe('init');
      expect(turnOfWar?.branch).toBe('main');

      const endlessCrusade = plan.find((a) => a.name === 'Assets/_Game/Submodules/EndlessCrusade');
      expect(endlessCrusade?.action).toBe('init');
      expect(endlessCrusade?.branch).toBe('main');

      const sensorToolkit = plan.find((a) => a.name === 'Assets/_Engine/Submodules/SensorToolkit');
      expect(sensorToolkit?.action).toBe('skip');
      expect(sensorToolkit?.branch).toBe('empty');

      const unmatched = plan.find((a) => a.name === 'Assets/_Game/Submodules/Unmatched');
      expect(unmatched?.action).toBe('skip');
      expect(unmatched?.branch).toBe('empty');
    });

    it('applies variant overlay when variantPath is provided', async () => {
      const profileYaml = `
submodules:
  - name: TurnOfWar
    branch: main
  - name: EndlessCrusade
    branch: main
`;

      const variantYaml = `
submodules:
  - name: EndlessCrusade
    branch: empty
`;

      const gitmodulesContent = `[submodule "Assets/_Game/Submodules/TurnOfWar"]
\tpath = Assets/_Game/Submodules/TurnOfWar
\turl = https://github.com/org/TurnOfWar.git
[submodule "Assets/_Game/Submodules/EndlessCrusade"]
\tpath = Assets/_Game/Submodules/EndlessCrusade
\turl = https://github.com/org/EndlessCrusade.git
`;

      mockedFs.existsSync.mockReturnValue(true);
      mockedFs.readFileSync.mockImplementation((filePath: any) => {
        const p = String(filePath);
        if (p.endsWith('profile.yml')) return profileYaml;
        if (p.endsWith('variant.yml')) return variantYaml;
        if (p.endsWith('.gitmodules')) return gitmodulesContent;
        return '';
      });

      const plan = await SubmoduleProfileService.createInitPlan(
        '/path/to/profile.yml',
        '/path/to/variant.yml',
        '/repo',
      );

      expect(plan).toHaveLength(2);

      const turnOfWar = plan.find((a) => a.name === 'Assets/_Game/Submodules/TurnOfWar');
      expect(turnOfWar?.action).toBe('init');

      const endlessCrusade = plan.find((a) => a.name === 'Assets/_Game/Submodules/EndlessCrusade');
      expect(endlessCrusade?.action).toBe('skip');
    });
  });

  describe('execute', () => {
    it('runs init commands for init actions and deinit for skip actions', async () => {
      mockedSystem.Run.mockResolvedValue('');

      const plan = [
        { name: 'ModuleA', path: 'Assets/ModuleA', branch: 'main', action: 'init' as const },
        { name: 'ModuleB', path: 'Assets/ModuleB', branch: 'develop', action: 'init' as const },
        { name: 'ModuleC', path: 'Assets/ModuleC', branch: 'empty', action: 'skip' as const },
      ];

      await SubmoduleProfileService.execute(plan, '/repo');

      // ModuleA: init only (branch is main, no checkout needed)
      expect(mockedSystem.Run).toHaveBeenCalledWith('git submodule update --init Assets/ModuleA');

      // ModuleB: init + checkout develop
      expect(mockedSystem.Run).toHaveBeenCalledWith('git submodule update --init Assets/ModuleB');
      expect(mockedSystem.Run).toHaveBeenCalledWith('git -C Assets/ModuleB checkout develop');

      // ModuleC: deinit
      expect(mockedSystem.Run).toHaveBeenCalledWith('git submodule deinit -f Assets/ModuleC 2>/dev/null || true');
    });

    it('configures auth when token is provided', async () => {
      mockedSystem.Run.mockResolvedValue('');

      await SubmoduleProfileService.execute([], '/repo', 'my-secret-token');

      expect(mockedSystem.Run).toHaveBeenCalledWith(
        'git config url."https://my-secret-token@github.com/".insteadOf "https://github.com/"',
      );
    });

    it('does not configure auth when no token is provided', async () => {
      mockedSystem.Run.mockResolvedValue('');

      await SubmoduleProfileService.execute([], '/repo');

      expect(mockedSystem.Run).not.toHaveBeenCalledWith(expect.stringContaining('git config url'));
    });
  });
});
