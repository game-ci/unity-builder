import * as AWS from 'aws-sdk';

class RemoteBuilderTaskDef {
  public taskDefStackName!: string;
  public taskDefCloudFormation!: string;
  public taskDefStackNameTTL!: string;
  public ttlCloudFormation!: string;
  public taskDefResources: AWS.CloudFormation.StackResources | undefined;
  public baseResources: AWS.CloudFormation.StackResources | undefined;
  public logid!: string;
}
export default RemoteBuilderTaskDef;
