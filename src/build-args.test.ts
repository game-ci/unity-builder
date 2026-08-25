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

  it('omits --engineVersion when unityVersion is unset or "auto"', () => {
    const noneSet = buildCliArgs(inputsOf({ targetPlatform: 'StandaloneLinux64' }));
    const explicitAuto = buildCliArgs(
      inputsOf({ targetPlatform: 'StandaloneLinux64', unityVersion: 'auto' }),
    );

    expect(noneSet.some((arg) => arg.startsWith('--engineVersion'))).toBe(false);
    expect(explicitAuto.some((arg) => arg.startsWith('--engineVersion'))).toBe(false);
  });

  it('maps an explicit unityVersion to --engineVersion, overriding auto-detection', () => {
    const args = buildCliArgs(
      inputsOf({ targetPlatform: 'WebGL', unityVersion: '6000.0.36f1' }),
    );

    expect(args).toContain('--engineVersion=6000.0.36f1');
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

  describe('providerStrategy=local (default) regression', () => {
    // A full, representative sweep of every carried-forward `build` flag,
    // asserted byte-identical to what the pre-local-system implementation
    // produced. If this ever fails, the local/default branch changed -
    // which it must not, since local-system is meant to be strictly
    // additive.
    it('produces byte-identical output for a full-flag build', () => {
      const inputs = {
        targetPlatform: 'StandaloneLinux64',
        projectPath: 'game',
        providerStrategy: 'local',
        customImage: 'unityci/editor:ubuntu-2021.3.1f1',
        buildProfile: 'Assets/Profile.asset',
        buildName: 'MyGame',
        buildsPath: 'build',
        buildMethod: 'Foo.Bar',
        customParameters: '-profile SomeProfile -someBoolean',
        versioning: 'Tag',
        version: '1.2.3',
        androidVersionCode: '7',
        androidExportType: 'androidAppBundle',
        androidKeystoreName: 'keystore.keystore',
        androidKeystoreBase64: 'base64==',
        androidKeystorePass: 'keystore-secret',
        androidKeyaliasName: 'my-alias',
        androidKeyaliasPass: 'alias-secret',
        androidTargetSdkVersion: '33',
        androidSymbolType: 'public',
        sshAgent: '/tmp/ssh-agent.sock',
        sshPublicKeysDirectoryPath: '/tmp/keys',
        gitPrivateToken: 'ghp_token',
        chownFilesTo: '1000:1000',
        dockerCpuLimit: '4',
        dockerMemoryLimit: '4g',
        dockerIsolationMode: 'process',
        containerRegistryRepository: 'unityci/editor',
        containerRegistryImageVersion: '3',
        unityHubVersionOnMac: '3.4.0',
        unityLicensingServer: 'http://license.example.com',
        dockerWorkspacePath: '/github/workspace',
        manualExit: 'true',
        enableGpu: 'true',
        useHostNetwork: 'true',
        runAsHostUser: 'true',
        allowDirtyBuild: 'true',
        cacheUnityInstallationOnMac: 'true',
        skipActivation: 'true',
        linux64RemoveExecutableExtension: 'true',
      };

      expect(buildCliArgs(inputsOf(inputs))).toStrictEqual([
        'build',
        'game',
        '--targetPlatform=StandaloneLinux64',
        '--customImage=unityci/editor:ubuntu-2021.3.1f1',
        '--buildProfile=Assets/Profile.asset',
        '--buildName=MyGame',
        '--buildsPath=build',
        '--buildMethod=Foo.Bar',
        '--customParameters=-profile SomeProfile -someBoolean',
        '--versioningStrategy=Tag',
        '--version=1.2.3',
        '--androidVersionCode=7',
        '--androidExportType=androidAppBundle',
        '--androidKeystoreName=keystore.keystore',
        '--androidKeystoreBase64=base64==',
        '--androidKeystorePassword=keystore-secret',
        '--androidKeyAlias=my-alias',
        '--androidKeyAliasPassword=alias-secret',
        '--androidTargetSdkVersion=33',
        '--androidSymbolType=public',
        '--sshAgent=/tmp/ssh-agent.sock',
        '--sshPublicKeysDirectoryPath=/tmp/keys',
        '--gitPrivateToken=ghp_token',
        '--chownFilesTo=1000:1000',
        '--dockerCpuLimit=4',
        '--dockerMemoryLimit=4g',
        '--dockerIsolationMode=process',
        '--containerRegistryRepository=unityci/editor',
        '--containerRegistryImageVersion=3',
        '--unityHubVersionOnMac=3.4.0',
        '--unityLicensingServer=http://license.example.com',
        '--dockerWorkspacePath=/github/workspace',
        '--manualExit',
        '--enableGpu',
        '--useHostNetwork',
        '--runAsHostUser',
        '--allowDirtyBuild',
        '--cacheUnityInstallationOnMac',
        '--skipActivation',
        '--linux64RemoveExecutableExtension',
      ]);
    });

    it('produces byte-identical output when providerStrategy is left unset (default)', () => {
      expect(
        buildCliArgs(inputsOf({ targetPlatform: 'StandaloneLinux64', buildName: 'MyGame' })),
      ).toStrictEqual(['build', '--targetPlatform=StandaloneLinux64', '--buildName=MyGame']);
    });
  });

  describe('providerStrategy=local-system', () => {
    it('shells out to `orchestrate` with --providerStrategy=local-system', () => {
      const args = buildCliArgs(
        inputsOf({ targetPlatform: 'StandaloneLinux64', providerStrategy: 'local-system' }),
      );

      expect(args).toStrictEqual([
        'orchestrate',
        '--targetPlatform=StandaloneLinux64',
        '--providerStrategy=local-system',
      ]);
    });

    it('still requires targetPlatform', () => {
      expect(() => buildCliArgs(inputsOf({ providerStrategy: 'local-system' }))).toThrow(
        /targetPlatform/,
      );
    });

    it('puts projectPath as the positional argument right after "orchestrate", matching the build branch', () => {
      const args = buildCliArgs(
        inputsOf({
          targetPlatform: 'StandaloneLinux64',
          providerStrategy: 'local-system',
          projectPath: 'game',
        }),
      );

      expect(args).toStrictEqual([
        'orchestrate',
        'game',
        '--targetPlatform=StandaloneLinux64',
        '--providerStrategy=local-system',
      ]);
    });

    it('carries forward every verified-supported flag', () => {
      const inputs = {
        targetPlatform: 'StandaloneLinux64',
        providerStrategy: 'local-system',
        buildName: 'MyGame',
        buildsPath: 'build',
        buildMethod: 'Foo.Bar',
        buildProfile: 'Assets/Profile.asset',
        androidVersionCode: '7',
        chownFilesTo: '1000:1000',
        sshAgent: '/tmp/ssh-agent.sock',
        sshPublicKeysDirectoryPath: '/tmp/keys',
        gitPrivateToken: 'ghp_token',
        manualExit: 'true',
        allowDirtyBuild: 'true',
        skipActivation: 'true',
        engineLaunchWrapper: 'flock /tmp/engine.lock --',
        localCacheMode: 'copy-directory',
        enableBuildRetry: 'true',
        localCacheEnabled: 'true',
        localCacheLibrary: 'true',
        localCacheLfs: 'true',
      };

      const args = buildCliArgs(inputsOf(inputs));

      expect(args).toContain('--buildName=MyGame');
      expect(args).toContain('--buildsPath=build');
      expect(args).toContain('--buildMethod=Foo.Bar');
      expect(args).toContain('--buildProfile=Assets/Profile.asset');
      expect(args).toContain('--androidVersionCode=7');
      expect(args).toContain('--chownFilesTo=1000:1000');
      expect(args).toContain('--sshAgent=/tmp/ssh-agent.sock');
      expect(args).toContain('--sshPublicKeysDirectoryPath=/tmp/keys');
      expect(args).toContain('--gitPrivateToken=ghp_token');
      expect(args).toContain('--manualExit');
      expect(args).toContain('--allowDirtyBuild');
      expect(args).toContain('--skipActivation');
      expect(args).toContain('--engineLaunchWrapper=flock /tmp/engine.lock --');
      expect(args).toContain('--localCacheMode=copy-directory');
      expect(args).toContain('--enableBuildRetry');
      expect(args).toContain('--localCacheEnabled');
      expect(args).toContain('--localCacheLibrary');
      expect(args).toContain('--localCacheLfs');
    });

    it('never emits build-only/Docker-only flags that have no orchestrate-side equivalent', () => {
      const inputs = {
        targetPlatform: 'StandaloneLinux64',
        providerStrategy: 'local-system',
        customImage: 'unityci/editor:ubuntu-2021.3.1f1',
        customParameters: '-profile SomeProfile',
        versioning: 'Tag',
        version: '1.2.3',
        androidExportType: 'androidAppBundle',
        androidKeystoreName: 'keystore.keystore',
        androidKeystoreBase64: 'base64==',
        androidKeystorePass: 'keystore-secret',
        androidKeyaliasName: 'my-alias',
        androidKeyaliasPass: 'alias-secret',
        androidTargetSdkVersion: '33',
        androidSymbolType: 'public',
        dockerCpuLimit: '4',
        dockerMemoryLimit: '4g',
        dockerIsolationMode: 'process',
        containerRegistryRepository: 'unityci/editor',
        containerRegistryImageVersion: '3',
        unityHubVersionOnMac: '3.4.0',
        unityLicensingServer: 'http://license.example.com',
        dockerWorkspacePath: '/github/workspace',
        enableGpu: 'true',
        useHostNetwork: 'true',
        runAsHostUser: 'true',
        cacheUnityInstallationOnMac: 'true',
        linux64RemoveExecutableExtension: 'true',
      };

      const args = buildCliArgs(inputsOf(inputs));

      const excludedFlags = [
        'customImage',
        'customParameters',
        'versioning',
        'versioningStrategy',
        'version',
        'androidExportType',
        'androidKeystoreName',
        'androidKeystoreBase64',
        'androidKeystorePassword',
        'androidKeyAlias',
        'androidKeyAliasPassword',
        'androidTargetSdkVersion',
        'androidSymbolType',
        'dockerCpuLimit',
        'dockerMemoryLimit',
        'dockerIsolationMode',
        'containerRegistryRepository',
        'containerRegistryImageVersion',
        'unityHubVersionOnMac',
        'unityLicensingServer',
        'dockerWorkspacePath',
        'enableGpu',
        'useHostNetwork',
        'runAsHostUser',
        'cacheUnityInstallationOnMac',
        'linux64RemoveExecutableExtension',
      ];

      for (const flag of excludedFlags) {
        expect(args.some((arg) => arg === `--${flag}` || arg.startsWith(`--${flag}=`))).toBe(false);
      }
    });

    it('omits the new orchestrator-only flags when their inputs are unset', () => {
      const args = buildCliArgs(
        inputsOf({ targetPlatform: 'StandaloneLinux64', providerStrategy: 'local-system' }),
      );

      expect(args.some((arg) => arg.startsWith('--engineLaunchWrapper='))).toBe(false);
      expect(args.some((arg) => arg.startsWith('--localCacheMode='))).toBe(false);
      expect(args).not.toContain('--enableBuildRetry');
      expect(args).not.toContain('--localCacheEnabled');
      expect(args).not.toContain('--localCacheLibrary');
      expect(args).not.toContain('--localCacheLfs');
    });
  });

  it('still throws for a non-local/non-local-system providerStrategy', () => {
    expect(() =>
      buildCliArgs(inputsOf({ targetPlatform: 'StandaloneLinux64', providerStrategy: 'aws' })),
    ).toThrow(/aws/);
  });
});
