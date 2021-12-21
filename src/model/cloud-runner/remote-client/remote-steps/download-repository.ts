import { CloudRunnerState } from '../../state/cloud-runner-state';
import { RunCli } from '../run-cli';

export class DownloadRepository {
  public static async run() {
    await RunCli.RunCli(`
      tree -f -L 2tree -f -L 2
      echo "test"
      mkdir -p ${CloudRunnerState.buildPathFull}
      mkdir -p ${CloudRunnerState.repoPathFull}
      echo ' '
      echo 'Initializing source repository for cloning with caching of LFS files'
      githubSha=$GITHUB_SHA
    `);
    await RunCli.RunCli(`
      cd ${CloudRunnerState.repoPathFull}
      # stop annoying git detatched head info
      git config --global advice.detachedHead false
      echo ' '
      echo "Cloning the repository being built:"
      git lfs install --skip-smudge
      echo "${CloudRunnerState.targetBuildRepoUrl}"
      git clone ${CloudRunnerState.targetBuildRepoUrl} ${CloudRunnerState.repoPathFull}
      git checkout $githubSha
      echo "Checked out $githubSha"
    `);
    await RunCli.RunCli(`
      git lfs ls-files -l | cut -d ' ' -f1 | sort > .lfs-assets-guid
      md5sum .lfs-assets-guid > .lfs-assets-guid-sum
    `);
    await RunCli.RunCli(`
      export LFS_ASSETS_HASH="$(cat ${CloudRunnerState.repoPathFull}/.lfs-assets-guid)"
    `);
    await RunCli.RunCli(`
      echo ' '
      echo 'Contents of .lfs-assets-guid file:'
      cat .lfs-assets-guid
      echo ' '
      echo 'Contents of .lfs-assets-guid-sum file:'
      cat .lfs-assets-guid-sum
      echo ' '
      echo 'Source repository initialized'
      ls ${CloudRunnerState.projectPathFull}
      echo ' '
    `);
    await RunCli.RunCli(`
      echo 'Starting checks of cache for the Unity project Library and git LFS files'
      ${CloudRunnerState.getHandleCachingCommand}
    `);
  }
}
