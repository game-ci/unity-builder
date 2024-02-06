import CloudRunner from '../../../cloud-runner';

export class TaskDefinitionFormation {
  public static readonly description: string = `Game CI Cloud Runner Task Stack`;
  public static get formation(): string {
    return `AWSTemplateFormatVersion: 2010-09-09
Description: ${TaskDefinitionFormation.description}
Parameters:
  EnvironmentName:
    Type: String
    Default: development
    Description: 'Your deployment environment: DEV, QA , PROD'
  ServiceName:
    Type: String
    Default: example
    Description: A name for the service
  LogGroupName:
    Type: String
    Default: example
    Description: Name to use for the log group created for this task
  ImageUrl:
    Type: String
    Default: nginx
    Description: >-
      The url of a docker image that contains the application process that will
      handle the traffic for this service
  ContainerPort:
    Type: Number
    Default: 80
    Description: What port number the application inside the docker container is binding to
  ContainerCpu:
    Default: ${CloudRunner.buildParameters.containerCpu}
    Type: Number
    Description: How much CPU to give the container. 1024 is 1 CPU
  ContainerMemory:
    Default: ${CloudRunner.buildParameters.containerMemory}
    Type: Number
    Description: How much memory in megabytes to give the container
  BUILDGUID:
    Type: String
    Default: ''
  Command:
    Type: String
    Default: 'ls'
  EntryPoint:
    Type: String
    Default: '/bin/sh'
  WorkingDirectory:
    Type: String
    Default: '/efsdata/'
  Role:
    Type: String
    Default: ''
    Description: >-
      (Optional) An IAM role to give the service's containers if the code within
      needs to access other AWS resources like S3 buckets, DynamoDB tables, etc
  EFSMountDirectory:
    Type: String
    Default: '/efsdata'
  # template secrets p1 - input
Mappings:
  SubnetConfig:
    VPC:
      CIDR: 10.0.0.0/16
    PublicOne:
      CIDR: 10.0.0.0/24
    PublicTwo:
      CIDR: 10.0.1.0/24
Conditions:
  HasCustomRole: !Not
    - !Equals
      - Ref: Role
      - ''
Resources:
  LogGroup:
    Type: 'AWS::Logs::LogGroup'
    Properties:
      LogGroupName: !Ref LogGroupName
    Metadata:
      'AWS::CloudFormation::Designer':
        id: aece53ae-b82d-4267-bc16-ed964b05db27
  # template resources secrets

  # template resources logstream

  TaskDefinition:
    Type: 'AWS::ECS::TaskDefinition'
    Properties:
      Family: !Ref ServiceName
      Cpu: !Ref ContainerCpu
      Memory: !Ref ContainerMemory
      NetworkMode: awsvpc
      Volumes:
        - Name: efs-data
          EFSVolumeConfiguration:
            FilesystemId:
              'Fn::ImportValue': !Sub '${'${EnvironmentName}'}:EfsFileStorageId'
            TransitEncryption: DISABLED
      RequiresCompatibilities:
        - FARGATE
      ExecutionRoleArn:
        'Fn::ImportValue': !Sub '${'${EnvironmentName}'}:ECSTaskExecutionRole'
      TaskRoleArn:
        'Fn::If':
          - HasCustomRole
          - !Ref Role
          - !Ref 'AWS::NoValue'
      ContainerDefinitions:
        - Name: !Ref ServiceName
          Cpu: !Ref ContainerCpu
          Memory: !Ref ContainerMemory
          Image: !Ref ImageUrl
          EntryPoint:
            Fn::Split:
              - ','
              - !Ref EntryPoint
          Command:
            Fn::Split:
              - ','
              - !Ref Command
          WorkingDirectory: !Ref WorkingDirectory
          Environment:
            - Name: ALLOW_EMPTY_PASSWORD
              Value: 'yes'
            # template - env vars
          MountPoints:
            - SourceVolume: efs-data
              ContainerPath: !Ref EFSMountDirectory
              ReadOnly: false
          Secrets:
            # template secrets p3 - container def
          LogConfiguration:
            LogDriver: awslogs
            Options:
              awslogs-group: !Ref LogGroupName
              awslogs-region: !Ref 'AWS::Region'
              awslogs-stream-prefix: !Ref ServiceName
    DependsOn:
      - LogGroup
`;
  }
  public static streamLogs = `
  SubscriptionFilter:
    Type: 'AWS::Logs::SubscriptionFilter'
    Properties:
      FilterPattern: ''
      RoleArn:
        'Fn::ImportValue': !Sub '${'${EnvironmentName}'}:CloudWatchIAMRole'
      LogGroupName: !Ref LogGroupName
      DestinationArn:
        'Fn::GetAtt':
          - KinesisStream
          - Arn
    Metadata:
      'AWS::CloudFormation::Designer':
        id: 7f809e91-9e5d-4678-98c1-c5085956c480
    DependsOn:
      - LogGroup
      - KinesisStream
  KinesisStream:
    Type: 'AWS::Kinesis::Stream'
    Properties:
      Name: !Ref ServiceName
      ShardCount: 1
    Metadata:
      'AWS::CloudFormation::Designer':
        id: c6f18447-b879-4696-8873-f981b2cedd2b
`;
}
