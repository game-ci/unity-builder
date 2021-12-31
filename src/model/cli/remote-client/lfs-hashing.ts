import path from 'path';
import { CloudRunnerState } from '../../cloud-runner/state/cloud-runner-state';
import { CloudRunnerAgentSystem } from './cloud-runner-agent-system';
import fs from 'fs';
import { assert } from 'console';
import { Input } from '../..';
import { RemoteClientLogger } from './remote-client-logger';

export class LFSHashing {
  public static async createLFSHashFiles() {
    try {
      await CloudRunnerAgentSystem.Run(`git lfs ls-files -l | cut -d ' ' -f1 | sort > .lfs-assets-guid`);
      await CloudRunnerAgentSystem.Run(`md5sum .lfs-assets-guid > .lfs-assets-guid-sum`);
      assert(fs.existsSync(`.lfs-assets-guid-sum`));
      assert(fs.existsSync(`.lfs-assets-guid`));
      const lfsHashes = {
        lfsGuid: fs.readFileSync(`${path.join(CloudRunnerState.repoPathFull, `.lfs-assets-guid`)}`, 'utf8'),
        lfsGuidSum: fs.readFileSync(`${path.join(CloudRunnerState.repoPathFull, `.lfs-assets-guid-sum`)}`, 'utf8'),
      };
      if (Input.cloudRunnerTests) {
        RemoteClientLogger.log(lfsHashes.lfsGuid);
        RemoteClientLogger.log(lfsHashes.lfsGuidSum);
      }
      return lfsHashes;
    } catch (error) {
      throw error;
    }
  }
}
