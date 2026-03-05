import BuildParameters from '../../build-parameters';
import RemotePowershellProvider from './remote-powershell';
import GitHubActionsProvider from './github-actions';
import GitLabCIProvider from './gitlab-ci';
import AnsibleProvider from './ansible';

/**
 * Tests for provider selection logic in Orchestrator.setProvider.
 *
 * These tests verify that the correct provider class is instantiated based on
 * the providerStrategy field in BuildParameters. Rather than invoking the full
 * Orchestrator.setProvider (which has heavy dependencies on OrchestratorOptions,
 * AWS detection, etc.), we test the provider constructors directly to verify
 * they produce the right provider type from the same build parameters the
 * orchestrator switch statement uses.
 */
describe('Provider Selection', () => {
  describe('remote-powershell provider', () => {
    it('creates RemotePowershellProvider from build parameters', () => {
      const params = {
        providerStrategy: 'remote-powershell',
        remotePowershellHost: 'build-server.local',
        remotePowershellTransport: 'wsman',
        remotePowershellCredential: 'user:pass',
      } as BuildParameters;

      const provider = new RemotePowershellProvider(params);

      expect(provider).toBeInstanceOf(RemotePowershellProvider);
      expect(provider.constructor.name).toBe('RemotePowershellProvider');
    });
  });

  describe('github-actions provider', () => {
    it('creates GitHubActionsProvider from build parameters', () => {
      const params = {
        providerStrategy: 'github-actions',
        githubActionsRepo: 'org/repo',
        githubActionsWorkflow: 'ci.yml',
        githubActionsToken: 'ghp_token',
        githubActionsRef: 'main',
      } as BuildParameters;

      const provider = new GitHubActionsProvider(params);

      expect(provider).toBeInstanceOf(GitHubActionsProvider);
      expect(provider.constructor.name).toBe('GitHubActionsProvider');
    });
  });

  describe('gitlab-ci provider', () => {
    it('creates GitLabCIProvider from build parameters', () => {
      const params = {
        providerStrategy: 'gitlab-ci',
        gitlabProjectId: 'group/project',
        gitlabTriggerToken: 'glptt-token',
        gitlabApiUrl: 'https://gitlab.com',
        gitlabRef: 'main',
      } as BuildParameters;

      const provider = new GitLabCIProvider(params);

      expect(provider).toBeInstanceOf(GitLabCIProvider);
      expect(provider.constructor.name).toBe('GitLabCIProvider');
    });
  });

  describe('ansible provider', () => {
    it('creates AnsibleProvider from build parameters', () => {
      const params = {
        providerStrategy: 'ansible',
        ansibleInventory: '/etc/ansible/hosts',
        ansiblePlaybook: '/playbooks/build.yml',
        ansibleExtraVars: '',
        ansibleVaultPassword: '',
      } as BuildParameters;

      const provider = new AnsibleProvider(params);

      expect(provider).toBeInstanceOf(AnsibleProvider);
      expect(provider.constructor.name).toBe('AnsibleProvider');
    });
  });

  describe('provider strategy routing', () => {
    it('each provider strategy maps to a distinct provider class', () => {
      const strategies: Record<string, new (params: BuildParameters) => any> = {
        'remote-powershell': RemotePowershellProvider,
        'github-actions': GitHubActionsProvider,
        'gitlab-ci': GitLabCIProvider,
        ansible: AnsibleProvider,
      };

      const params = {
        remotePowershellHost: 'host',
        remotePowershellTransport: 'wsman',
        remotePowershellCredential: '',
        githubActionsRepo: 'org/repo',
        githubActionsWorkflow: 'ci.yml',
        githubActionsToken: 'token',
        githubActionsRef: 'main',
        gitlabProjectId: 'proj',
        gitlabTriggerToken: 'tok',
        gitlabApiUrl: 'https://gitlab.com',
        gitlabRef: 'main',
        ansibleInventory: '/inv',
        ansiblePlaybook: '/pb.yml',
        ansibleExtraVars: '',
        ansibleVaultPassword: '',
      } as BuildParameters;

      const instances = Object.entries(strategies).map(([strategy, ProviderClass]) => {
        const provider = new ProviderClass(params);
        return { strategy, className: provider.constructor.name };
      });

      // Verify all four strategies produce different provider classes
      const classNames = instances.map((i) => i.className);
      const uniqueClassNames = new Set(classNames);
      expect(uniqueClassNames.size).toBe(4);

      // Verify expected mapping
      expect(instances.find((i) => i.strategy === 'remote-powershell')!.className).toBe('RemotePowershellProvider');
      expect(instances.find((i) => i.strategy === 'github-actions')!.className).toBe('GitHubActionsProvider');
      expect(instances.find((i) => i.strategy === 'gitlab-ci')!.className).toBe('GitLabCIProvider');
      expect(instances.find((i) => i.strategy === 'ansible')!.className).toBe('AnsibleProvider');
    });

    it('all providers implement ProviderInterface methods', () => {
      const params = {
        remotePowershellHost: 'host',
        githubActionsRepo: 'org/repo',
        githubActionsWorkflow: 'ci.yml',
        githubActionsToken: 'token',
        gitlabProjectId: 'proj',
        gitlabTriggerToken: 'tok',
        ansibleInventory: '/inv',
      } as BuildParameters;

      const providers = [
        new RemotePowershellProvider(params),
        new GitHubActionsProvider(params),
        new GitLabCIProvider(params),
        new AnsibleProvider(params),
      ];

      const requiredMethods = [
        'setupWorkflow',
        'runTaskInWorkflow',
        'cleanupWorkflow',
        'garbageCollect',
        'listResources',
        'listWorkflow',
        'watchWorkflow',
      ];

      for (const provider of providers) {
        for (const method of requiredMethods) {
          expect(typeof (provider as any)[method]).toBe('function');
        }
      }
    });
  });
});
