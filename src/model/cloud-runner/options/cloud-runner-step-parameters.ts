import CloudRunnerEnvironmentVariable from './cloud-runner-environment-variable';
import CloudRunnerSecret from './cloud-runner-secret';

export class CloudRunnerStepParameters {
  public image: string;
  public environment: CloudRunnerEnvironmentVariable[];
  public secrets: CloudRunnerSecret[];
  constructor(image: string, environmentVariables: CloudRunnerEnvironmentVariable[], secrets: CloudRunnerSecret[]) {
    this.image = image;
    this.environment = environmentVariables;
    this.secrets = secrets;
  }
}
