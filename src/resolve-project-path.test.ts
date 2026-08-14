import { describe, it, expect } from 'vitest';
import { resolveProjectPath } from './resolve-project-path';

function fsOf(existingPaths: string[]) {
  return {
    joinPath: (...segments: string[]) => segments.join('/'),
    existsSync: (candidate: string) => existingPaths.includes(candidate),
  };
}

describe('resolveProjectPath', () => {
  it('returns the explicit input unchanged when given', () => {
    const result = resolveProjectPath({
      input: 'my-project',
      ...fsOf(['test-project/ProjectSettings/ProjectVersion.txt']),
    });

    expect(result).toBe('my-project');
  });

  it('strips a trailing slash from an explicit input', () => {
    const result = resolveProjectPath({ input: 'my-project/', ...fsOf([]) });

    expect(result).toBe('my-project');
  });

  it('defaults to "test-project" when it looks like a Unity project and the repo root does not', () => {
    const result = resolveProjectPath({
      input: '',
      ...fsOf(['test-project/ProjectSettings/ProjectVersion.txt']),
    });

    expect(result).toBe('test-project');
  });

  it('does not default to "test-project" when the repo root is itself a Unity project', () => {
    const result = resolveProjectPath({
      input: '',
      ...fsOf([
        'test-project/ProjectSettings/ProjectVersion.txt',
        'ProjectSettings/ProjectVersion.txt',
      ]),
    });

    expect(result).toBe('');
  });

  it('returns empty (letting the cli default to ".") when neither location looks like a Unity project', () => {
    const result = resolveProjectPath({ input: '', ...fsOf([]) });

    expect(result).toBe('');
  });
});
