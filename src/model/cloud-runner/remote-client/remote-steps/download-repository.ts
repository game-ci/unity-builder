import { CloudRunnerState } from '../../state/cloud-runner-state';

const { exec } = require('child_process');

export class DownloadRepository {
  public static async run() {
    await new Promise<void>((promise) => {
      exec(
        `
      echo "test"
      mkdir -p ${CloudRunnerState.buildPathFull}
      mkdir -p ${CloudRunnerState.repoPathFull}
      echo ' '
      echo 'Initializing source repository for cloning with caching of LFS files'
      repoPathFull=${CloudRunnerState.repoPathFull}
      cloneUrl=${CloudRunnerState.targetBuildRepoUrl}

      githubSha=$GITHUB_SHA

      cd $repoPathFull

      # stop annoying git detatched head info
      git config --global advice.detachedHead false

      echo ' '
      echo "Cloning the repository being built:"
      git lfs install --skip-smudge
      git clone $cloneUrl $repoPathFull
      git checkout $githubSha
      echo "Checked out $githubSha"

      git lfs ls-files -l | cut -d ' ' -f1 | sort > .lfs-assets-guid
      md5sum .lfs-assets-guid > .lfs-assets-guid-sum
      export LFS_ASSETS_HASH="$(cat $repoPathFull/.lfs-assets-guid)"

      echo ' '
      echo 'Contents of .lfs-assets-guid file:'
      cat .lfs-assets-guid

      echo ' '
      echo 'Contents of .lfs-assets-guid-sum file:'
      cat .lfs-assets-guid-sum

      echo ' '
      # echo 'Source repository initialized'
      # ls ${CloudRunnerState.projectPathFull}
      # echo ' '
      # echo 'Starting checks of cache for the Unity project Library and git LFS files'
      # ${CloudRunnerState.getHandleCachingCommand}
      `,
        (error, stdout, stderr) => {
          if (error) {
            // eslint-disable-next-line no-console
            console.log(`error: ${error.message}`);
            promise();
            return;
          }
          if (stderr) {
            // eslint-disable-next-line no-console
            console.log(`stderr: ${stderr}`);
            promise();
            return;
          }
          // eslint-disable-next-line no-console
          console.log(`stdout: ${stdout}`);
          promise();
        },
      );
    });
  }
}
