import buildCommand from '../commands/build';
import testCommand from '../commands/test';
import activateCommand from '../commands/activate';
import orchestrateCommand from '../commands/orchestrate';
import statusCommand from '../commands/status';
import versionCommand from '../commands/version';
import updateCommand from '../commands/update';

function createFakeYargs(): { yargs: any; options: Record<string, any> } {
  const options: Record<string, any> = {};
  const yargs: any = {
    option: jest.fn(),
    positional: jest.fn(),
    example: jest.fn(),
    env: jest.fn(),
  };

  yargs.option.mockImplementation((name: string, config: any) => {
    options[name] = config;

    return yargs;
  });
  yargs.positional.mockImplementation((name: string, config: any) => {
    options[name] = config;

    return yargs;
  });
  yargs.example.mockReturnValue(yargs);
  yargs.env.mockReturnValue(yargs);

  return { yargs, options };
}

describe('CLI commands', () => {
  describe('build command', () => {
    it('exports the correct command name', () => {
      expect(buildCommand.command).toStrictEqual('build');
    });

    it('has a description', () => {
      expect(buildCommand.describe).toBeTruthy();
    });

    it('has a builder function', () => {
      expect(typeof buildCommand.builder).toStrictEqual('function');
    });

    it('has a handler function', () => {
      expect(typeof buildCommand.handler).toStrictEqual('function');
    });

    it('defines all expected build flags via builder', () => {
      const { yargs, options } = createFakeYargs();

      (buildCommand.builder as Function)(yargs);

      // Core build flags (from shared + build-specific)
      expect(options['target-platform']).toBeDefined();
      expect(options['target-platform'].demandOption).toStrictEqual(true);
      expect(options['unity-version']).toBeDefined();
      expect(options['project-path']).toBeDefined();
      expect(options['build-profile']).toBeDefined();
      expect(options['build-name']).toBeDefined();
      expect(options['builds-path']).toBeDefined();
      expect(options['build-method']).toBeDefined();
      expect(options['custom-parameters']).toBeDefined();
      expect(options['versioning']).toBeDefined();
      expect(options['version']).toBeDefined();
      expect(options['custom-image']).toBeDefined();
      expect(options['manual-exit']).toBeDefined();
      expect(options['enable-gpu']).toBeDefined();

      // Android flags
      expect(options['android-version-code']).toBeDefined();
      expect(options['android-export-type']).toBeDefined();
      expect(options['android-keystore-name']).toBeDefined();
      expect(options['android-keystore-base64']).toBeDefined();
      expect(options['android-keystore-pass']).toBeDefined();
      expect(options['android-keyalias-name']).toBeDefined();
      expect(options['android-keyalias-pass']).toBeDefined();
      expect(options['android-target-sdk-version']).toBeDefined();
      expect(options['android-symbol-type']).toBeDefined();

      // Docker flags
      expect(options['docker-cpu-limit']).toBeDefined();
      expect(options['docker-memory-limit']).toBeDefined();
      expect(options['docker-workspace-path']).toBeDefined();
      expect(options['run-as-host-user']).toBeDefined();
      expect(options['chown-files-to']).toBeDefined();

      // Build should NOT have orchestrator-specific flags
      expect(options['provider-strategy']).toBeUndefined();
      expect(options['aws-stack-name']).toBeUndefined();
      expect(options['kube-config']).toBeUndefined();
    });

    it('sets correct default values', () => {
      const { yargs, options } = createFakeYargs();

      (buildCommand.builder as Function)(yargs);

      expect(options['unity-version'].default).toStrictEqual('auto');
      expect(options['project-path'].default).toStrictEqual('.');
      expect(options['builds-path'].default).toStrictEqual('build');
      expect(options['versioning'].default).toStrictEqual('Semantic');
      expect(options['manual-exit'].default).toStrictEqual(false);
      expect(options['enable-gpu'].default).toStrictEqual(false);
      expect(options['android-export-type'].default).toStrictEqual('androidPackage');
      expect(options['android-symbol-type'].default).toStrictEqual('none');
    });

    it('provides camelCase aliases for kebab-case options', () => {
      const { yargs, options } = createFakeYargs();

      (buildCommand.builder as Function)(yargs);

      expect(options['target-platform'].alias).toStrictEqual('targetPlatform');
      expect(options['unity-version'].alias).toStrictEqual('unityVersion');
      expect(options['project-path'].alias).toStrictEqual('projectPath');
      expect(options['build-name'].alias).toStrictEqual('buildName');
      expect(options['builds-path'].alias).toStrictEqual('buildsPath');
      expect(options['build-method'].alias).toStrictEqual('buildMethod');
    });
  });

  describe('test command', () => {
    it('exports command with alias', () => {
      expect(testCommand.command).toStrictEqual(['test', 't']);
    });

    it('has a description', () => {
      expect(testCommand.describe).toBeTruthy();
    });

    it('has a builder function', () => {
      expect(typeof testCommand.builder).toStrictEqual('function');
    });

    it('has a handler function', () => {
      expect(typeof testCommand.handler).toStrictEqual('function');
    });

    it('defines test-specific flags', () => {
      const { yargs, options } = createFakeYargs();

      (testCommand.builder as Function)(yargs);

      expect(options['test-mode']).toBeDefined();
      expect(options['test-mode'].default).toStrictEqual('All');
      expect(options['test-mode'].choices).toStrictEqual(['EditMode', 'PlayMode', 'All']);
      expect(options['test-results-path']).toBeDefined();
      expect(options['test-category']).toBeDefined();
      expect(options['test-filter']).toBeDefined();
      expect(options['enable-code-coverage']).toBeDefined();
      expect(options['coverage-options']).toBeDefined();
    });

    it('includes shared project options', () => {
      const { yargs, options } = createFakeYargs();

      (testCommand.builder as Function)(yargs);

      expect(options['target-platform']).toBeDefined();
      expect(options['target-platform'].demandOption).toStrictEqual(true);
      expect(options['unity-version']).toBeDefined();
      expect(options['project-path']).toBeDefined();
      expect(options['custom-image']).toBeDefined();
    });

    it('includes docker options but not orchestrator options', () => {
      const { yargs, options } = createFakeYargs();

      (testCommand.builder as Function)(yargs);

      expect(options['docker-cpu-limit']).toBeDefined();
      expect(options['docker-memory-limit']).toBeDefined();
      expect(options['provider-strategy']).toBeUndefined();
      expect(options['aws-stack-name']).toBeUndefined();
    });
  });

  describe('activate command', () => {
    it('exports the correct command name', () => {
      expect(activateCommand.command).toStrictEqual('activate');
    });

    it('has a description', () => {
      expect(activateCommand.describe).toBeTruthy();
    });

    it('has a builder function', () => {
      expect(typeof activateCommand.builder).toStrictEqual('function');
    });

    it('has a handler function', () => {
      expect(typeof activateCommand.handler).toStrictEqual('function');
    });
  });

  describe('orchestrate command', () => {
    it('exports command with alias', () => {
      expect(orchestrateCommand.command).toStrictEqual(['orchestrate', 'o']);
    });

    it('has a description', () => {
      expect(orchestrateCommand.describe).toBeTruthy();
    });

    it('has a builder function', () => {
      expect(typeof orchestrateCommand.builder).toStrictEqual('function');
    });

    it('has a handler function', () => {
      expect(typeof orchestrateCommand.handler).toStrictEqual('function');
    });

    it('defines key orchestrator flags', () => {
      const { yargs, options } = createFakeYargs();

      (orchestrateCommand.builder as Function)(yargs);

      expect(options['target-platform']).toBeDefined();
      expect(options['target-platform'].demandOption).toStrictEqual(true);
      expect(options['provider-strategy']).toBeDefined();
      expect(options['provider-strategy'].default).toStrictEqual('aws');
      expect(options['aws-stack-name']).toBeDefined();
      expect(options['kube-config']).toBeDefined();
      expect(options['kube-volume']).toBeDefined();
      expect(options['cache-key']).toBeDefined();
      expect(options['watch-to-end']).toBeDefined();
      expect(options['clone-depth']).toBeDefined();
    });

    it('does not include build-only options', () => {
      const { yargs, options } = createFakeYargs();

      (orchestrateCommand.builder as Function)(yargs);

      expect(options['build-profile']).toBeUndefined();
      expect(options['manual-exit']).toBeUndefined();
      expect(options['enable-gpu']).toBeUndefined();
      expect(options['android-version-code']).toBeUndefined();
    });
  });

  describe('status command', () => {
    it('exports the correct command name', () => {
      expect(statusCommand.command).toStrictEqual('status');
    });

    it('has a description', () => {
      expect(statusCommand.describe).toBeTruthy();
    });

    it('has a handler function', () => {
      expect(typeof statusCommand.handler).toStrictEqual('function');
    });

    it('includes cache-dir option', () => {
      const { yargs, options } = createFakeYargs();

      (statusCommand.builder as Function)(yargs);

      expect(options['cache-dir']).toBeDefined();
      expect(options['project-path']).toBeDefined();
    });
  });

  describe('version command', () => {
    it('exports the correct command name', () => {
      expect(versionCommand.command).toStrictEqual('version');
    });

    it('has a description', () => {
      expect(versionCommand.describe).toBeTruthy();
    });

    it('has a handler function', () => {
      expect(typeof versionCommand.handler).toStrictEqual('function');
    });
  });

  describe('update command', () => {
    it('exports the correct command name', () => {
      expect(updateCommand.command).toStrictEqual('update');
    });

    it('has a description', () => {
      expect(updateCommand.describe).toBeTruthy();
    });

    it('has a builder function', () => {
      expect(typeof updateCommand.builder).toStrictEqual('function');
    });

    it('has a handler function', () => {
      expect(typeof updateCommand.handler).toStrictEqual('function');
    });

    it('defines force and version flags', () => {
      const { yargs, options } = createFakeYargs();

      (updateCommand.builder as Function)(yargs);

      expect(options['force']).toBeDefined();
      expect(options['force'].type).toStrictEqual('boolean');
      expect(options['force'].default).toStrictEqual(false);
      expect(options['version']).toBeDefined();
      expect(options['version'].type).toStrictEqual('string');
    });
  });
});
