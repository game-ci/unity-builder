export interface RemoteBuilderProviderInterface {
  run(): Promise<void>;
}
