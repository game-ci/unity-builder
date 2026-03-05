import { mapCliArgumentsToInput, CliArguments } from '../input-mapper';
import { Cli } from '../../model/cli/cli';
import GitHub from '../../model/github';

afterEach(() => {
  jest.restoreAllMocks();
  Cli.options = undefined;
});

describe('mapCliArgumentsToInput', () => {
  describe('basic mapping', () => {
    it('populates Cli.options from CLI arguments', () => {
      const cliArguments: CliArguments = {
        targetPlatform: 'StandaloneLinux64',
        unityVersion: '2022.3.56f1',
        projectPath: './my-project',
      };

      mapCliArgumentsToInput(cliArguments);

      expect(Cli.options).toBeDefined();
      expect(Cli.options!['targetPlatform']).toStrictEqual('StandaloneLinux64');
      expect(Cli.options!['unityVersion']).toStrictEqual('2022.3.56f1');
      expect(Cli.options!['projectPath']).toStrictEqual('./my-project');
    });

    it('disables GitHub Actions input reading', () => {
      const cliArguments: CliArguments = { targetPlatform: 'WebGL' };

      mapCliArgumentsToInput(cliArguments);

      expect(GitHub.githubInputEnabled).toStrictEqual(false);
    });

    it('sets mode to cli by default when not provided', () => {
      const cliArguments: CliArguments = { targetPlatform: 'Android' };

      mapCliArgumentsToInput(cliArguments);

      expect(Cli.options!['mode']).toStrictEqual('cli');
    });

    it('preserves an explicitly provided mode', () => {
      const cliArguments: CliArguments = { targetPlatform: 'Android', mode: 'custom-mode' };

      mapCliArgumentsToInput(cliArguments);

      expect(Cli.options!['mode']).toStrictEqual('custom-mode');
    });
  });

  describe('default values', () => {
    it('omits undefined values from Cli.options', () => {
      const cliArguments: CliArguments = {
        targetPlatform: 'StandaloneLinux64',
        unityVersion: undefined,
        buildName: undefined,
      };

      mapCliArgumentsToInput(cliArguments);

      expect(Cli.options!['targetPlatform']).toStrictEqual('StandaloneLinux64');
      expect(Cli.options!).not.toHaveProperty('unityVersion');
      expect(Cli.options!).not.toHaveProperty('buildName');
    });
  });

  describe('boolean conversion', () => {
    it('converts boolean true to string "true"', () => {
      const cliArguments: CliArguments = { manualExit: true };

      mapCliArgumentsToInput(cliArguments);

      expect(Cli.options!['manualExit']).toStrictEqual('true');
    });

    it('converts boolean false to string "false"', () => {
      const cliArguments: CliArguments = { enableGpu: false };

      mapCliArgumentsToInput(cliArguments);

      expect(Cli.options!['enableGpu']).toStrictEqual('false');
    });

    it('converts allowDirtyBuild boolean to string', () => {
      const cliArguments: CliArguments = { allowDirtyBuild: true };

      mapCliArgumentsToInput(cliArguments);

      expect(Cli.options!['allowDirtyBuild']).toStrictEqual('true');
    });
  });

  describe('yargs internal properties', () => {
    it('filters out yargs _ property', () => {
      const cliArguments: CliArguments = {
        targetPlatform: 'iOS',
        _: ['build'] as any,
      };

      mapCliArgumentsToInput(cliArguments);

      expect(Cli.options!).not.toHaveProperty('_');
    });

    it('filters out yargs $0 property', () => {
      const cliArguments: CliArguments = {
        targetPlatform: 'iOS',
        $0: 'game-ci' as any,
      };

      mapCliArgumentsToInput(cliArguments);

      expect(Cli.options!).not.toHaveProperty('$0');
    });
  });

  describe('flag name conversion', () => {
    it('passes camelCase keys through directly', () => {
      const cliArguments: CliArguments = {
        androidKeystoreName: 'my.keystore',
        androidKeystorePass: 'secret',
        dockerCpuLimit: '4',
        dockerMemoryLimit: '8g',
      };

      mapCliArgumentsToInput(cliArguments);

      expect(Cli.options!['androidKeystoreName']).toStrictEqual('my.keystore');
      expect(Cli.options!['androidKeystorePass']).toStrictEqual('secret');
      expect(Cli.options!['dockerCpuLimit']).toStrictEqual('4');
      expect(Cli.options!['dockerMemoryLimit']).toStrictEqual('8g');
    });

    it('maps all android-related arguments', () => {
      const cliArguments: CliArguments = {
        androidVersionCode: '42',
        androidExportType: 'androidAppBundle',
        androidKeystoreBase64: 'base64data',
        androidKeyaliasName: 'myalias',
        androidKeyaliasPass: 'aliaspass',
        androidTargetSdkVersion: '33',
        androidSymbolType: 'public',
      };

      mapCliArgumentsToInput(cliArguments);

      expect(Cli.options!['androidVersionCode']).toStrictEqual('42');
      expect(Cli.options!['androidExportType']).toStrictEqual('androidAppBundle');
      expect(Cli.options!['androidKeystoreBase64']).toStrictEqual('base64data');
      expect(Cli.options!['androidKeyaliasName']).toStrictEqual('myalias');
      expect(Cli.options!['androidKeyaliasPass']).toStrictEqual('aliaspass');
      expect(Cli.options!['androidTargetSdkVersion']).toStrictEqual('33');
      expect(Cli.options!['androidSymbolType']).toStrictEqual('public');
    });

    it('maps docker and container arguments', () => {
      const cliArguments: CliArguments = {
        dockerIsolationMode: 'hyperv',
        dockerWorkspacePath: '/custom/workspace',
        containerRegistryRepository: 'custom/editor',
        containerRegistryImageVersion: '5',
        runAsHostUser: 'true',
        chownFilesTo: 'root:root',
      };

      mapCliArgumentsToInput(cliArguments);

      expect(Cli.options!['dockerIsolationMode']).toStrictEqual('hyperv');
      expect(Cli.options!['dockerWorkspacePath']).toStrictEqual('/custom/workspace');
      expect(Cli.options!['containerRegistryRepository']).toStrictEqual('custom/editor');
      expect(Cli.options!['containerRegistryImageVersion']).toStrictEqual('5');
      expect(Cli.options!['runAsHostUser']).toStrictEqual('true');
      expect(Cli.options!['chownFilesTo']).toStrictEqual('root:root');
    });

    it('maps orchestrator-related arguments', () => {
      const cliArguments: CliArguments = {
        providerStrategy: 'k8s',
        awsStackName: 'my-stack',
        kubeConfig: 'base64config',
        kubeVolume: 'my-pvc',
        kubeVolumeSize: '10Gi',
        kubeStorageClass: 'gp3',
        containerCpu: '2048',
        containerMemory: '4096',
        cacheKey: 'my-cache',
        watchToEnd: 'false',
        cloneDepth: '100',
      };

      mapCliArgumentsToInput(cliArguments);

      expect(Cli.options!['providerStrategy']).toStrictEqual('k8s');
      expect(Cli.options!['awsStackName']).toStrictEqual('my-stack');
      expect(Cli.options!['kubeConfig']).toStrictEqual('base64config');
      expect(Cli.options!['kubeVolume']).toStrictEqual('my-pvc');
      expect(Cli.options!['kubeVolumeSize']).toStrictEqual('10Gi');
      expect(Cli.options!['kubeStorageClass']).toStrictEqual('gp3');
      expect(Cli.options!['containerCpu']).toStrictEqual('2048');
      expect(Cli.options!['containerMemory']).toStrictEqual('4096');
      expect(Cli.options!['cacheKey']).toStrictEqual('my-cache');
      expect(Cli.options!['watchToEnd']).toStrictEqual('false');
      expect(Cli.options!['cloneDepth']).toStrictEqual('100');
    });
  });

  describe('Cli.isCliMode integration', () => {
    it('enables CLI mode after mapping', () => {
      const cliArguments: CliArguments = { targetPlatform: 'WebGL' };

      mapCliArgumentsToInput(cliArguments);

      expect(Cli.isCliMode).toStrictEqual(true);
    });

    it('is not in CLI mode before mapping', () => {
      expect(Cli.isCliMode).toStrictEqual(false);
    });
  });
});
