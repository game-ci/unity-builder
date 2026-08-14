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
      '--targetPlatform=StandaloneLinux64',
    ]);
  });

  it('puts projectPath as the positional argument right after "build"', () => {
    expect(
      buildCliArgs(inputsOf({ targetPlatform: 'StandaloneLinux64', projectPath: 'game' })),
    ).toStrictEqual(['build', 'game', '--targetPlatform=StandaloneLinux64']);
  });

  it('throws for a non-local providerStrategy, matching the base action without @game-ci/orchestrator', () => {
    expect(() =>
      buildCliArgs(inputsOf({ targetPlatform: 'StandaloneLinux64', providerStrategy: 'aws' })),
    ).toThrow(/aws/);
  });

  it('passes string inputs through as their mapped flag, glued with = to avoid value/flag ambiguity', () => {
    const args = buildCliArgs(
      inputsOf({
        targetPlatform: 'StandaloneLinux64',
        buildName: 'MyGame',
        buildMethod: 'Foo.Bar',
        dockerCpuLimit: '4',
      }),
    );

    expect(args).toContain('--buildName=MyGame');
    expect(args).toContain('--buildMethod=Foo.Bar');
    expect(args).toContain('--dockerCpuLimit=4');
  });

  it('keeps a value starting with "-" as one unambiguous token', () => {
    // A value like this ("-profile Foo -someBoolean") would otherwise be
    // misread as a separate flag by yargs if passed as "--flag value"
    // (two argv tokens) - see the regression this covers.
    const args = buildCliArgs(
      inputsOf({
        targetPlatform: 'StandaloneLinux64',
        customParameters: '-profile SomeProfile -someBoolean -someValue exampleValue',
      }),
    );

    expect(args).toContain(
      '--customParameters=-profile SomeProfile -someBoolean -someValue exampleValue',
    );
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

    expect(args).toContain('--androidKeystorePassword=keystore-secret');
    expect(args).toContain('--androidKeyAlias=my-alias');
    expect(args).toContain('--androidKeyAliasPassword=alias-secret');
    // The deprecated cli flag names should never be emitted.
    expect(args.some((arg) => arg.startsWith('--androidKeystorePass='))).toBe(false);
    expect(args.some((arg) => arg.startsWith('--androidKeyAliasName='))).toBe(false);
    expect(args.some((arg) => arg.startsWith('--androidKeyAliasPass='))).toBe(false);
  });

  it('renames versioning to versioningStrategy', () => {
    const args = buildCliArgs(inputsOf({ targetPlatform: 'StandaloneLinux64', versioning: 'Tag' }));

    expect(args).toContain('--versioningStrategy=Tag');
    expect(args.some((arg) => arg.startsWith('--versioning='))).toBe(false);
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

    expect(args).toStrictEqual(['build', '--targetPlatform=StandaloneLinux64']);
  });
});
