import { StackResource } from '@aws-sdk/client-cloudformation';

class CloudRunnerAWSTaskDef {
  public taskDefStackName!: string;
  public taskDefCloudFormation!: string;
  public taskDefResources: StackResource[] | undefined;
  public baseResources: StackResource[] | undefined;
}
export default CloudRunnerAWSTaskDef;
