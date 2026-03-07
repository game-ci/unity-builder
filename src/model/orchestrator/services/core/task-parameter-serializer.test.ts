import { TaskParameterSerializer } from './task-parameter-serializer';

// Mock dependencies that TaskParameterSerializer uses internally
jest.mock('@actions/core', () => ({
  getInput: jest.fn().mockReturnValue(''),
  setOutput: jest.fn(),
  info: jest.fn(),
  warning: jest.fn(),
  error: jest.fn(),
}));

jest.mock('../../options/orchestrator-options', () => ({
  __esModule: true,
  default: {
    getInput: jest.fn().mockReturnValue(undefined),
    ToEnvVarFormat: (input: string) => {
      if (input.toUpperCase() === input) {
        return input;
      }
      return input
        .replace(/([A-Z])/g, ' $1')
        .trim()
        .toUpperCase()
        .replace(/ /g, '_');
    },
  },
}));

jest.mock('../../options/orchestrator-options-reader', () => ({
  __esModule: true,
  default: {
    GetProperties: jest.fn().mockReturnValue([]),
  },
}));

jest.mock('../../options/orchestrator-query-override', () => ({
  __esModule: true,
  default: {
    queryOverrides: undefined,
  },
}));

jest.mock('../hooks/command-hook-service', () => ({
  CommandHookService: {
    getHooks: jest.fn().mockReturnValue([]),
    getSecrets: jest.fn().mockReturnValue([]),
  },
}));

jest.mock('../../../input', () => ({
  __esModule: true,
  default: {},
}));

jest.mock('../../../github', () => ({
  __esModule: true,
  default: {
    githubInputEnabled: false,
  },
}));

describe('TaskParameterSerializer', () => {
  describe('ToEnvVarFormat', () => {
    it('converts camelCase to UPPER_SNAKE_CASE', () => {
      expect(TaskParameterSerializer.ToEnvVarFormat('targetPlatform')).toBe('TARGET_PLATFORM');
    });

    it('converts single word to uppercase', () => {
      expect(TaskParameterSerializer.ToEnvVarFormat('version')).toBe('VERSION');
    });

    it('preserves already-uppercase strings', () => {
      expect(TaskParameterSerializer.ToEnvVarFormat('AWS_REGION')).toBe('AWS_REGION');
    });

    it('handles multi-word camelCase', () => {
      expect(TaskParameterSerializer.ToEnvVarFormat('buildPlatformTarget')).toBe('BUILD_PLATFORM_TARGET');
    });

    it('handles string starting with uppercase', () => {
      expect(TaskParameterSerializer.ToEnvVarFormat('BuildGuid')).toBe('BUILD_GUID');
    });
  });

  describe('UndoEnvVarFormat', () => {
    it('converts UPPER_SNAKE_CASE back to camelCase', () => {
      expect(TaskParameterSerializer.UndoEnvVarFormat('TARGET_PLATFORM')).toBe('targetPlatform');
    });

    it('handles single word', () => {
      expect(TaskParameterSerializer.UndoEnvVarFormat('VERSION')).toBe('version');
    });

    it('handles multiple underscores', () => {
      expect(TaskParameterSerializer.UndoEnvVarFormat('BUILD_PLATFORM_TARGET')).toBe('buildPlatformTarget');
    });
  });

  describe('round-trip conversion', () => {
    it('ToEnvVarFormat -> UndoEnvVarFormat returns original for simple camelCase', () => {
      const original = 'targetPlatform';
      const envVar = TaskParameterSerializer.ToEnvVarFormat(original);
      const roundTrip = TaskParameterSerializer.UndoEnvVarFormat(envVar);
      expect(roundTrip).toBe(original);
    });

    it('round-trips multi-word keys', () => {
      const original = 'cacheKey';
      const envVar = TaskParameterSerializer.ToEnvVarFormat(original);
      const roundTrip = TaskParameterSerializer.UndoEnvVarFormat(envVar);
      expect(roundTrip).toBe(original);
    });
  });

  describe('uniqBy', () => {
    it('removes duplicates by key function', () => {
      const items = [
        { name: 'A', value: '1' },
        { name: 'B', value: '2' },
        { name: 'A', value: '3' },
      ];
      const result = TaskParameterSerializer.uniqBy(items, (x) => x.name);
      expect(result).toHaveLength(2);
      expect(result[0].value).toBe('1');
      expect(result[1].value).toBe('2');
    });

    it('returns all items when no duplicates', () => {
      const items = [
        { name: 'A', value: '1' },
        { name: 'B', value: '2' },
        { name: 'C', value: '3' },
      ];
      const result = TaskParameterSerializer.uniqBy(items, (x) => x.name);
      expect(result).toHaveLength(3);
    });

    it('handles empty array', () => {
      const result = TaskParameterSerializer.uniqBy([], (x) => x.name);
      expect(result).toHaveLength(0);
    });

    it('keeps first occurrence when duplicates exist', () => {
      const items = [
        { name: 'KEY', value: 'first' },
        { name: 'KEY', value: 'second' },
        { name: 'KEY', value: 'third' },
      ];
      const result = TaskParameterSerializer.uniqBy(items, (x) => x.name);
      expect(result).toHaveLength(1);
      expect(result[0].value).toBe('first');
    });
  });

  describe('blockedParameterNames', () => {
    it('contains expected blocked names', () => {
      expect(TaskParameterSerializer.blockedParameterNames.has('0')).toBe(true);
      expect(TaskParameterSerializer.blockedParameterNames.has('length')).toBe(true);
      expect(TaskParameterSerializer.blockedParameterNames.has('prototype')).toBe(true);
      expect(TaskParameterSerializer.blockedParameterNames.has('')).toBe(true);
      expect(TaskParameterSerializer.blockedParameterNames.has('unityVersion')).toBe(true);
      expect(TaskParameterSerializer.blockedParameterNames.has('CUSTOM_JOB')).toBe(true);
    });

    it('does not block valid parameter names', () => {
      expect(TaskParameterSerializer.blockedParameterNames.has('targetPlatform')).toBe(false);
      expect(TaskParameterSerializer.blockedParameterNames.has('buildGuid')).toBe(false);
      expect(TaskParameterSerializer.blockedParameterNames.has('cacheKey')).toBe(false);
    });
  });

  describe('readDefaultSecrets', () => {
    it('returns an array', () => {
      const secrets = TaskParameterSerializer.readDefaultSecrets();
      expect(Array.isArray(secrets)).toBe(true);
    });

    it('includes secrets from environment when present', () => {
      const originalSerial = process.env.UNITY_SERIAL;
      process.env.UNITY_SERIAL = 'test-serial';

      const secrets = TaskParameterSerializer.readDefaultSecrets();
      const serialSecret = secrets.find((s) => s.ParameterKey === 'UNITY_SERIAL');
      expect(serialSecret).toBeDefined();
      expect(serialSecret?.ParameterValue).toBe('test-serial');

      if (originalSerial !== undefined) {
        process.env.UNITY_SERIAL = originalSerial;
      } else {
        delete process.env.UNITY_SERIAL;
      }
    });

    it('excludes secrets not in environment', () => {
      const originalSerial = process.env.UNITY_SERIAL;
      delete process.env.UNITY_SERIAL;

      const secrets = TaskParameterSerializer.readDefaultSecrets();
      const serialSecret = secrets.find((s) => s.ParameterKey === 'UNITY_SERIAL');
      expect(serialSecret).toBeUndefined();

      if (originalSerial !== undefined) {
        process.env.UNITY_SERIAL = originalSerial;
      }
    });
  });
});
