import { describe, it, expect } from 'vitest';
import { buildCliArgs } from './build-args';

function inputsOf(values: Record<string, string>) {
  return { getInput: (name: string) => values[name] ?? '' };
}

describe('buildCliArgs', () => {
  it('requires targetPlatform', () => {
    expect(() => buildCliArgs(inputsOf({}))).toThrow(/targetPlatform/);
  });

  it('builds the minimal command for a bare targetPlatform', () => {
    expect(buildCliArgs(inputsOf({ targetPlatform: 'StandaloneLinux64' }))).toStrictEqual([
      'build',
      '--targetPlatform',
      'StandaloneLinux64',
    ]);
  });

  it('puts projectPath as the positional argument right after "build"', () => {
    expect(
      buildCliArgs(inputsOf({ targetPlatform: 'StandaloneLinux64', projectPath: 'game' })),
    ).toStrictEqual(['build', 'game', '--targetPlatform', 'StandaloneLinux64']);
  });

  it('throws for a non-local providerStrategy, matching the base action without @game-ci/orchestrator', () => {
    expect(() =>
      buildCliArgs(inputsOf({ targetPlatform: 'StandaloneLinux64', providerStrategy: 'aws' })),
    ).toThrow(/aws/);
  });

  it('passes string inputs through as their mapped flag', () => {
    const args = buildCliArgs(
      inputsOf({
        targetPlatform: 'StandaloneLinux64',
        buildName: 'MyGame',
        buildMethod: 'Foo.Bar',
        dockerCpuLimit: '4',
      }),
    );

    expect(args).toContain('--buildName');
    expect(args).toContain('MyGame');
    expect(args).toContain('--buildMethod');
    expect(args).toContain('Foo.Bar');
    expect(args).toContain('--dockerCpuLimit');
    expect(args).toContain('4');
  });

  it('remaps android inputs to their current (non-deprecated) cli flag names', () => {
    const args = buildCliArgs(
      inputsOf({
        targetPlatform: 'Android',
        androidKeystorePass: 'keystore-secret',
        androidKeyaliasName: 'my-alias',
        androidKeyaliasPass: 'alias-secret',
      }),
    );

    expect(args).toContain('--androidKeystorePassword');
    expect(args).toContain('keystore-secret');
    expect(args).toContain('--androidKeyAlias');
    expect(args).toContain('my-alias');
    expect(args).toContain('--androidKeyAliasPassword');
    expect(args).toContain('alias-secret');
    // The deprecated cli flag names should never be emitted.
    expect(args).not.toContain('--androidKeystorePass');
    expect(args).not.toContain('--androidKeyAliasName');
    expect(args).not.toContain('--androidKeyAliasPass');
  });

  it('renames versioning to versioningStrategy', () => {
    const args = buildCliArgs(inputsOf({ targetPlatform: 'StandaloneLinux64', versioning: 'Tag' }));

    expect(args).toContain('--versioningStrategy');
    expect(args).toContain('Tag');
    expect(args).not.toContain('--versioning');
  });

  it('emits boolean flags only when truthy, without a value', () => {
    const args = buildCliArgs(
      inputsOf({
        targetPlatform: 'StandaloneLinux64',
        manualExit: 'true',
        enableGpu: 'false',
        skipActivation: 'TRUE',
      }),
    );

    expect(args).toContain('--manualExit');
    expect(args).toContain('--skipActivation');
    expect(args).not.toContain('--enableGpu');
  });

  it('omits flags for empty/unset inputs, leaving cli defaults in effect', () => {
    const args = buildCliArgs(inputsOf({ targetPlatform: 'StandaloneLinux64' }));

    expect(args).toStrictEqual(['build', '--targetPlatform', 'StandaloneLinux64']);
  });
});
