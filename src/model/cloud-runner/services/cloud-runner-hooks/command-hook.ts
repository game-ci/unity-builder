import CloudRunnerSecret from '../../options/cloud-runner-secret';

export class CommandHook {
  public commands: string[] = new Array<string>();
  public secrets: CloudRunnerSecret[] = new Array<CloudRunnerSecret>();
  public name!: string;
  public hook!: string[];
  public step!: string[];
}
