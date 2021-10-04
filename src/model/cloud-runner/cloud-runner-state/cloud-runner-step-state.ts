import CloudRunnerEnvironmentVariable from '../cloud-runner-services/cloud-runner-environment-variable';
import CloudRunnerSecret from '../cloud-runner-services/cloud-runner-secret';

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
