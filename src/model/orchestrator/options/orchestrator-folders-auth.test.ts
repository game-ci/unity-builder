import { OrchestratorFolders } from './orchestrator-folders';

jest.mock('../orchestrator', () => ({
  __esModule: true,
  default: {
    buildParameters: {
      orchestratorRepoName: 'game-ci/unity-builder',
      githubRepo: 'myorg/myrepo',
      gitPrivateToken: 'ghp_test123',
      gitAuthMode: 'header',
      buildGuid: 'test-guid',
      projectPath: '',
      buildPath: 'Builds',
      cacheKey: 'test-cache',
    },
    lockedWorkspace: '',
  },
}));

jest.mock('./orchestrator-options', () => ({
  __esModule: true,
  default: {
    useSharedBuilder: false,
  },
}));

jest.mock('../services/core/orchestrator-system', () => ({
  OrchestratorSystem: {
    Run: jest.fn().mockResolvedValue(''),
  },
}));

const mockOrchestrator = require('../orchestrator').default;

describe('OrchestratorFolders git auth', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('useHeaderAuth', () => {
    it('should return true when gitAuthMode is header', () => {
      mockOrchestrator.buildParameters.gitAuthMode = 'header';
      expect(OrchestratorFolders.useHeaderAuth).toBe(true);
    });

    it('should return true when gitAuthMode is undefined (default)', () => {
      mockOrchestrator.buildParameters.gitAuthMode = undefined;
      expect(OrchestratorFolders.useHeaderAuth).toBe(true);
    });

    it('should return false when gitAuthMode is url', () => {
      mockOrchestrator.buildParameters.gitAuthMode = 'url';
      expect(OrchestratorFolders.useHeaderAuth).toBe(false);
    });
  });

  describe('unityBuilderRepoUrl', () => {
    it('should not include token in URL when using header auth', () => {
      mockOrchestrator.buildParameters.gitAuthMode = 'header';
      const url = OrchestratorFolders.unityBuilderRepoUrl;
      expect(url).toBe('https://github.com/game-ci/unity-builder.git');
      expect(url).not.toContain('ghp_test123');
    });

    it('should include token in URL when using url auth (legacy)', () => {
      mockOrchestrator.buildParameters.gitAuthMode = 'url';
      const url = OrchestratorFolders.unityBuilderRepoUrl;
      expect(url).toBe('https://ghp_test123@github.com/game-ci/unity-builder.git');
    });
  });

  describe('targetBuildRepoUrl', () => {
    it('should not include token in URL when using header auth', () => {
      mockOrchestrator.buildParameters.gitAuthMode = 'header';
      const url = OrchestratorFolders.targetBuildRepoUrl;
      expect(url).toBe('https://github.com/myorg/myrepo.git');
      expect(url).not.toContain('ghp_test123');
    });

    it('should include token in URL when using url auth (legacy)', () => {
      mockOrchestrator.buildParameters.gitAuthMode = 'url';
      const url = OrchestratorFolders.targetBuildRepoUrl;
      expect(url).toBe('https://ghp_test123@github.com/myorg/myrepo.git');
    });
  });

  describe('gitAuthConfigScript', () => {
    it('should emit http.extraHeader commands in header mode', () => {
      mockOrchestrator.buildParameters.gitAuthMode = 'header';
      const script = OrchestratorFolders.gitAuthConfigScript;
      expect(script).toContain('http.extraHeader');
      expect(script).toContain('GIT_PRIVATE_TOKEN');
      expect(script).toContain('Authorization: Basic');
    });

    it('should emit no-op comment in url mode', () => {
      mockOrchestrator.buildParameters.gitAuthMode = 'url';
      const script = OrchestratorFolders.gitAuthConfigScript;
      expect(script).toContain('legacy');
      expect(script).not.toContain('http.extraHeader');
    });
  });

  describe('configureGitAuth', () => {
    it('should run git config with http.extraHeader in header mode', async () => {
      mockOrchestrator.buildParameters.gitAuthMode = 'header';
      mockOrchestrator.buildParameters.gitPrivateToken = 'ghp_test123';
      const { OrchestratorSystem } = require('../services/core/orchestrator-system');

      await OrchestratorFolders.configureGitAuth();

      // Verify the base64 encoding and extraHeader config are correct
      const expectedEncoded = Buffer.from('x-access-token:ghp_test123').toString('base64');
      expect(OrchestratorSystem.Run).toHaveBeenCalledWith(
        expect.stringContaining(expectedEncoded),
      );
      expect(OrchestratorSystem.Run).toHaveBeenCalledWith(
        expect.stringContaining('.extraHeader'),
      );
    });

    it('should not run git config in url mode', async () => {
      mockOrchestrator.buildParameters.gitAuthMode = 'url';
      const { OrchestratorSystem } = require('../services/core/orchestrator-system');

      await OrchestratorFolders.configureGitAuth();

      expect(OrchestratorSystem.Run).not.toHaveBeenCalled();
    });

    it('should not run git config when no token is available', async () => {
      mockOrchestrator.buildParameters.gitAuthMode = 'header';
      mockOrchestrator.buildParameters.gitPrivateToken = '';
      const originalEnv = process.env.GIT_PRIVATE_TOKEN;
      delete process.env.GIT_PRIVATE_TOKEN;
      const { OrchestratorSystem } = require('../services/core/orchestrator-system');

      await OrchestratorFolders.configureGitAuth();

      expect(OrchestratorSystem.Run).not.toHaveBeenCalled();
      if (originalEnv !== undefined) process.env.GIT_PRIVATE_TOKEN = originalEnv;
    });
  });
});
