import CloudRunnerSecret from '../../options/cloud-runner-secret';

export class ContainerHook {
  public commands!: string;
  public secrets: CloudRunnerSecret[] = new Array<CloudRunnerSecret>();
  public name!: string;
  public image: string = `ubuntu`;
  public hook!: string;
  public allowFailure: boolean = false; // If true, hook failures won't stop the build
}
