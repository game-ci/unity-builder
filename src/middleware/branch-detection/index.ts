import System from '../../model/system/system.ts';
import { BranchDetector } from './branch-detector.ts';

export const branchDetection = async (argv) => {
  const { projectPath } = argv;

  const branch = await BranchDetector.getCurrentBranch(projectPath);

  // Todo - determine if we ever want to run the cli on a project that has no git repo.
  if (!branch) throw new Error('Running GameCI CLI on a project without a git repository is not supported.');

  argv.branch = branch;
};
