import OrchestratorSecret from '../../options/orchestrator-secret';

export class ContainerHook {
  public commands!: string;
  public secrets: OrchestratorSecret[] = new Array<OrchestratorSecret>();
  public name!: string;
  public image: string = `ubuntu`;
  public hook!: string;
  public allowFailure: boolean = false; // If true, hook failures won't stop the build
}
