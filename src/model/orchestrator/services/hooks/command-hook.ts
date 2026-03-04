import OrchestratorSecret from '../../options/orchestrator-secret';

export class CommandHook {
  public commands: string[] = new Array<string>();
  public secrets: OrchestratorSecret[] = new Array<OrchestratorSecret>();
  public name!: string;
  public hook!: string[];
  public step!: string[];
}
