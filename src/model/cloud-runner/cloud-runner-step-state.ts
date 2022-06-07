import CloudRunnerEnvironmentVariable from './services/cloud-runner-environment-variable.ts';
import CloudRunnerSecret from './services/cloud-runner-secret.ts';

export class CloudRunnerStepState {
  public image: string;
  public environment: CloudRunnerEnvironmentVariable[];
  public secrets: CloudRunnerSecret[];
  constructor(image: string, environmentVariables: CloudRunnerEnvironmentVariable[], secrets: CloudRunnerSecret[]) {
    this.image = image;
    this.environment = environmentVariables;
    this.secrets = secrets;
  }
}
