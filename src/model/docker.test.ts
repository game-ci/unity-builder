import { describe, it, expect, vi, beforeEach, afterEach, beforeAll, afterAll, test } from 'vitest';
import Action from './action';
import Docker from './docker';

describe('Docker', () => {
  it.skip('runs', async () => {
    const image = 'unity-builder:2019.2.11f1-webgl';
    const parameters = {
      workspace: Action.rootFolder,
      projectPath: `${Action.rootFolder}/test-project`,
      buildName: 'someBuildName',
      buildsPath: 'build',
      method: '',
    };
    await Docker.run(image, parameters);
  });

  // game-ci/unity-builder#840: Unity 6.6+ editors request 1GiB of shared
  // memory and hard-fail against Docker's 64m default. This action never
  // passed --shm-size at all, and exposed no input to work around it.
  describe('--shm-size', () => {
    const baseParameters = {
      workspace: '/github/workspace',
      actionFolder: '/action',
      runnerTempPath: Action.rootFolder,
      sshAgent: '',
      sshPublicKeysDirectoryPath: '',
      gitPrivateToken: '',
      dockerWorkspacePath: '/github/workspace',
      dockerCpuLimit: '4',
      dockerMemoryLimit: '8192m',
      dockerIsolationMode: 'default',
    };

    it('passes --shm-size on Linux when dockerShmSize is set', () => {
      const command = Docker.getLinuxCommand('unityci/editor:latest', {
        ...baseParameters,
        dockerShmSize: '1025m',
      } as any);

      expect(command).toContain('--shm-size=1025m');
    });

    it('passes --shm-size on Windows when dockerShmSize is set', () => {
      const command = Docker.getWindowsCommand('unityci/editor:latest', {
        ...baseParameters,
        dockerShmSize: '2g',
      } as any);

      expect(command).toContain('--shm-size=2g');
    });

    it('omits --shm-size when explicitly disabled with "0"', () => {
      const command = Docker.getLinuxCommand('unityci/editor:latest', {
        ...baseParameters,
        dockerShmSize: '0',
      } as any);

      expect(command).not.toContain('--shm-size');
    });

    it('omits --shm-size when unset, rather than emitting "--shm-size=undefined"', () => {
      const command = Docker.getLinuxCommand('unityci/editor:latest', baseParameters as any);

      expect(command).not.toContain('--shm-size');
    });
  });
});
