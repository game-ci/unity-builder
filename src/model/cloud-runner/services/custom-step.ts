import CloudRunnerSecret from './cloud-runner-secret';

export class CustomStep {
  public commands;
  public secrets: CloudRunnerSecret[] = new Array<CloudRunnerSecret>();
  public name;
  public image: string = `ubuntu`;
  public hook!: string;
}
