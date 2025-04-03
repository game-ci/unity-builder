import { StackResource } from '@aws-sdk/client-cloudformation';

class CloudRunnerAWSTaskDef {
  public taskDefStackName!: string;
  public taskDefCloudFormation!: string;
  public taskDefResources: Array<StackResource> | undefined;
  public baseResources: Array<StackResource> | undefined;
}
export default CloudRunnerAWSTaskDef;
