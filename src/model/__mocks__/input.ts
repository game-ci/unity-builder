// Import this named export into your test file:
import UnityTargetPlatform from '../unity/unity-target-platform.ts';

export const mockGetFromUser = jest.fn().mockResolvedValue({
  editorVersion: '',
  targetPlatform: UnityTargetPlatform.Test,
  projectPath: '.',
  buildName: UnityTargetPlatform.Test,
  buildsPath: 'build',
  buildMethod: undefined,
  buildVersion: '1.3.37',
  customParameters: '',
  sshAgent: '',
  chownFilesTo: '',
  gitPrivateToken: '',
});

export default {
  getFromUser: mockGetFromUser,
};
