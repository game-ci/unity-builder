import RemoteBuilderEnvironmentVariable from './remote-builder-environment-variable';
import RemoteBuilderSecret from './remote-builder-secret';

export interface RemoteBuilderProviderInterface {
  runBuildTask(
    // eslint-disable-next-line no-unused-vars
    buildId: string,
    // eslint-disable-next-line no-unused-vars
    image: string,
    // eslint-disable-next-line no-unused-vars
    commands: string[],
    // eslint-disable-next-line no-unused-vars
    mountdir: string,
    // eslint-disable-next-line no-unused-vars
    workingdir: string,
    // eslint-disable-next-line no-unused-vars
    environment: RemoteBuilderEnvironmentVariable[],
    // eslint-disable-next-line no-unused-vars
    secrets: RemoteBuilderSecret[],
  ): Promise<void>;
}
