import CloudRunnerSecret from './cloud-runner-secret';

export class CustomStep {
  public commands!: string;
  public secrets: CloudRunnerSecret[] = new Array<CloudRunnerSecret>();
  public name!: string;
  public image: string = `ubuntu`;
  public hook!: string;
}
