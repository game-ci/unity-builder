import { CloudRunnerState } from '../../cloud-runner/state/cloud-runner-state';
import { CliFunction } from '../cli-decorator';
import { RemoteClientLogger } from './remote-client-logger';
import { SetupCloudRunnerRepository } from './setup-cloud-runner-repository';

export class RemoteClient {
  @CliFunction(`remote-cli`, `sets up a repository, usually before a game-ci build`)
  static async run() {
    const buildParameter = JSON.parse(process.env.BUILD_PARAMETERS || '{}');
    RemoteClientLogger.log(`Build Params:
      ${JSON.stringify(buildParameter, undefined, 4)}
    `);
    CloudRunnerState.setup(buildParameter);
    await SetupCloudRunnerRepository.run();
  }
}
