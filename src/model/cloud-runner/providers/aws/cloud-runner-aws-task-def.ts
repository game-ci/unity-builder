import { aws } from '../../../../dependencies.ts';

class CloudRunnerAWSTaskDef {
  public taskDefStackName!: string;
  public taskDefCloudFormation!: string;
  public taskDefResources: aws.CloudFormation.StackResources | undefined;
  public baseResources: aws.CloudFormation.StackResources | undefined;
}
export default CloudRunnerAWSTaskDef;
