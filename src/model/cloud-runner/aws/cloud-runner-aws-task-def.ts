import * as AWS from 'aws-sdk';

class CloudRunnerAWSTaskDef {
  public taskDefStackName!: string;
  public taskDefCloudFormation!: string;
  public taskDefResources: AWS.CloudFormation.StackResources | undefined;
  public baseResources: AWS.CloudFormation.StackResources | undefined;
}
export default CloudRunnerAWSTaskDef;
