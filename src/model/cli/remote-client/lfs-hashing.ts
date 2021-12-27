import path from 'path';
import { CloudRunnerState } from '../../cloud-runner/state/cloud-runner-state';
import { CloudRunnerAgentSystem } from './cloud-runner-agent-system';
import fs from 'fs';

export class LFSHashing {
  public static async printLFSHashState() {
    await CloudRunnerAgentSystem.Run(
      `echo ' '
      echo 'Contents of .lfs-assets-guid file:'
      cat .lfs-assets-guid
      echo ' '
      echo 'Contents of .lfs-assets-guid-sum file:'
      cat .lfs-assets-guid-sum
      echo ' '
      echo 'Source repository initialized'
      ls ${CloudRunnerState.projectPathFull}
      echo ' '`,
    );
  }

  public static async createLFSHashFiles() {
    try {
      await CloudRunnerAgentSystem.Run(`git lfs ls-files -l | cut -d ' ' -f1 | sort > .lfs-assets-guid`);
      await CloudRunnerAgentSystem.Run(`md5sum .lfs-assets-guid > .lfs-assets-guid-sum`);
      return fs
        .readFileSync(`${path.join(CloudRunnerState.repoPathFull, `.lfs-assets-guid`)}`, 'utf8')
        .replace('\n', '');
    } catch (error) {
      throw error;
    }
  }
}
