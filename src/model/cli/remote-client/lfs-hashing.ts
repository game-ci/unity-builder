import path from 'path';
import { CloudRunnerState } from '../../cloud-runner/state/cloud-runner-state';
import { RemoteClientSystem } from './remote-client-system';
import fs from 'fs';

export class LFSHashing {
  public static async printLFSHashState() {
    await RemoteClientSystem.Run(
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
      await RemoteClientSystem.Run(`git lfs ls-files -l | cut -d ' ' -f1 | sort > .lfs-assets-guid`);
      await RemoteClientSystem.Run(`md5sum .lfs-assets-guid > .lfs-assets-guid-sum`);
      return fs.readFileSync(`${path.join(CloudRunnerState.repoPathFull, `.lfs-assets-guid`)}`, 'utf8');
    } catch (error) {
      throw error;
    }
  }
}
