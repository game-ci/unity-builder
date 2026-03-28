import orchestratorPlugin from './index';
import { createBuildParametersFromCliOptions } from './build-parameters-adapter';

describe('CLI Plugin Adapter', () => {
  describe('orchestratorPlugin', () => {
    it('has required GameCIPlugin fields', () => {
      expect(orchestratorPlugin.name).toBe('orchestrator');
      expect(orchestratorPlugin.version).toBe('3.0.0');
    });

    it('registers options plugin with wildcard engine', () => {
      expect(orchestratorPlugin.options).toHaveLength(1);
      expect(orchestratorPlugin.options[0].engine).toBe('*');
      expect(typeof orchestratorPlugin.options[0].configure).toBe('function');
    });

    it('exposes all built-in provider strategies', () => {
      const providers = orchestratorPlugin.providers;
      expect(providers).toHaveProperty('aws');
      expect(providers).toHaveProperty('k8s');
      expect(providers).toHaveProperty('local-docker');
      expect(providers).toHaveProperty('local-system');
      expect(providers).toHaveProperty('local');
      expect(providers).toHaveProperty('test');
    });

    it('provider constructors are functions', () => {
      for (const [, Ctor] of Object.entries(orchestratorPlugin.providers)) {
        expect(typeof Ctor).toBe('function');
      }
    });
  });

  describe('configureOrchestratorOptions', () => {
    it('registers options on a yargs-like object', () => {
      const registered: Record<string, any> = {};
      const mockYargs = {
        option(name: string, config: any) {
          registered[name] = config;

          return mockYargs;
        },
      };

      orchestratorPlugin.options[0].configure(mockYargs);

      // Spot-check key options

      expect(registered).toHaveProperty('containerCpu');
      expect(registered).toHaveProperty('containerMemory');
      expect(registered).toHaveProperty('awsStackName');
      expect(registered).toHaveProperty('kubeConfig');
      expect(registered).toHaveProperty('storageProvider');
      expect(registered).toHaveProperty('commandHooks');
      expect(registered).toHaveProperty('orchestratorDebug');
      expect(registered).toHaveProperty('region');
    });
  });

  describe('createBuildParametersFromCliOptions', () => {
    it('maps yargs options to BuildParameters', () => {
      const bp = createBuildParametersFromCliOptions({
        providerStrategy: 'aws',
        containerMemory: '4096',
        containerCpu: '2048',
        awsStackName: 'my-stack',
        targetPlatform: 'StandaloneLinux64',
        buildName: 'MyGame',
        kubeConfig: 'base64config',
      });

      expect(bp.providerStrategy).toBe('aws');
      expect(bp.containerMemory).toBe('4096');
      expect(bp.containerCpu).toBe('2048');
      expect(bp.awsStackName).toBe('my-stack');
      expect(bp.targetPlatform).toBe('StandaloneLinux64');
      expect(bp.buildName).toBe('MyGame');
      expect(bp.kubeConfig).toBe('base64config');
      expect(bp.isCliMode).toBe(true);
    });

    it('applies defaults for missing options', () => {
      const bp = createBuildParametersFromCliOptions({});

      expect(bp.providerStrategy).toBe('local-docker');
      expect(bp.containerMemory).toBe('3072');
      expect(bp.containerCpu).toBe('1024');
      expect(bp.awsStackName).toBe('game-ci');
      expect(bp.containerNamespace).toBe('default');
      expect(bp.kubeVolumeSize).toBe('25Gi');
      expect(bp.storageProvider).toBe('s3');
    });
  });
});
