import OrchestratorEnvironmentVariable from './orchestrator-environment-variable';
import OrchestratorSecret from './orchestrator-secret';

export class OrchestratorStepParameters {
  public image: string;
  public environment: OrchestratorEnvironmentVariable[];
  public secrets: OrchestratorSecret[];
  constructor(image: string, environmentVariables: OrchestratorEnvironmentVariable[], secrets: OrchestratorSecret[]) {
    this.image = image;
    this.environment = environmentVariables;
    this.secrets = secrets;
  }
}
