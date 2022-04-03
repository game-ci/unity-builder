import CloudRunnerEnvironmentVariable from './services/cloud-runner-environment-variable';
import CloudRunnerSecret from './services/cloud-runner-secret';

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
