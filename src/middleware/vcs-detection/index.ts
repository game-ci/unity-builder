import { GitDetector } from './git-detector.ts';

export const vcsDetection = async (argv) => {
  const { projectPath } = argv;

  const gitDetector = new GitDetector(projectPath);
  if (await gitDetector.isGitRepository()) {
    argv.branch = await gitDetector.getCurrentBranch(projectPath);
  }
};
