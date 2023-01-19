export class BaseStackFormation {
  public static readonly baseStackDecription = `Game-CI base stack`;
  public static readonly formation: string = `AWSTemplateFormatVersion: '2010-09-09'
Description: ${BaseStackFormation.baseStackDecription}
Parameters:
  EnvironmentName:
    Type: String
    Default: development
    Description: 'Your deployment environment: DEV, QA , PROD'
  Version:
    Type: String
    Description: 'hash of template'

  # ContainerPort:
  #   Type: Number
  #   Default: 80
  #   Description: What port number the application inside the docker container is binding to

Mappings:
  # Hard values for the subnet masks. These masks define
  # the range of internal IP addresses that can be assigned.
  # The VPC can have all IP's from 10.0.0.0 to 10.0.255.255
  # There are four subnets which cover the ranges:
  #
  # 10.0.0.0 - 10.0.0.255
  # 10.0.1.0 - 10.0.1.255
  # 10.0.2.0 - 10.0.2.255
  # 10.0.3.0 - 10.0.3.255

  SubnetConfig:
    VPC:
      CIDR: '10.0.0.0/16'
    PublicOne:
      CIDR: '10.0.0.0/24'
    PublicTwo:
      CIDR: '10.0.1.0/24'

Resources:
  # VPC in which containers will be networked.
  # It has two public subnets, and two private subnets.
  # We distribute the subnets across the first two available subnets
  # for the region, for high availability.
  VPC:
    Type: AWS::EC2::VPC
    Properties:
      EnableDnsSupport: true
      EnableDnsHostnames: true
      CidrBlock: !FindInMap ['SubnetConfig', 'VPC', 'CIDR']

  MainBucket:
    Type: "AWS::S3::Bucket"
    Properties:
      BucketName: !Ref EnvironmentName

  EFSServerSecurityGroup:
    Type: AWS::EC2::SecurityGroup
    Properties:
      GroupName: 'efs-server-endpoints'
      GroupDescription: Which client ip addrs are allowed to access EFS server
      VpcId: !Ref 'VPC'
      SecurityGroupIngress:
        - IpProtocol: tcp
          FromPort: 2049
          ToPort: 2049
          SourceSecurityGroupId: !Ref ContainerSecurityGroup
          #CidrIp: !FindInMap ['SubnetConfig', 'VPC', 'CIDR']
  # A security group for the containers we will run in Fargate.
  # Rules are added to this security group based on what ingress you
  # add for the cluster.
  ContainerSecurityGroup:
    Type: AWS::EC2::SecurityGroup
    Properties:
      GroupName: 'task security group'
      GroupDescription: Access to the Fargate containers
      VpcId: !Ref 'VPC'
      # SecurityGroupIngress:
      #   - IpProtocol: tcp
      #     FromPort: !Ref ContainerPort
      #     ToPort: !Ref ContainerPort
      #     CidrIp: 0.0.0.0/0
      SecurityGroupEgress:
        - IpProtocol: -1
          FromPort: 2049
          ToPort: 2049
          CidrIp: '0.0.0.0/0'

  # Two public subnets, where containers can have public IP addresses
  PublicSubnetOne:
    Type: AWS::EC2::Subnet
    Properties:
      AvailabilityZone: !Select
        - 0
        - Fn::GetAZs: !Ref 'AWS::Region'
      VpcId: !Ref 'VPC'
      CidrBlock: !FindInMap ['SubnetConfig', 'PublicOne', 'CIDR']
      #  MapPublicIpOnLaunch: true

  PublicSubnetTwo:
    Type: AWS::EC2::Subnet
    Properties:
      AvailabilityZone: !Select
        - 1
        - Fn::GetAZs: !Ref 'AWS::Region'
      VpcId: !Ref 'VPC'
      CidrBlock: !FindInMap ['SubnetConfig', 'PublicTwo', 'CIDR']
      #  MapPublicIpOnLaunch: true

  # Setup networking resources for the public subnets. Containers
  # in the public subnets have public IP addresses and the routing table
  # sends network traffic via the internet gateway.
  InternetGateway:
    Type: AWS::EC2::InternetGateway
  GatewayAttachement:
    Type: AWS::EC2::VPCGatewayAttachment
    Properties:
      VpcId: !Ref 'VPC'
      InternetGatewayId: !Ref 'InternetGateway'

  # Attaching a Internet Gateway to route table makes it public.
  PublicRouteTable:
    Type: AWS::EC2::RouteTable
    Properties:
      VpcId: !Ref 'VPC'
  PublicRoute:
    Type: AWS::EC2::Route
    DependsOn: GatewayAttachement
    Properties:
      RouteTableId: !Ref 'PublicRouteTable'
      DestinationCidrBlock: '0.0.0.0/0'
      GatewayId: !Ref 'InternetGateway'

  # Attaching a public route table makes a subnet public.
  PublicSubnetOneRouteTableAssociation:
    Type: AWS::EC2::SubnetRouteTableAssociation
    Properties:
      SubnetId: !Ref PublicSubnetOne
      RouteTableId: !Ref PublicRouteTable
  PublicSubnetTwoRouteTableAssociation:
    Type: AWS::EC2::SubnetRouteTableAssociation
    Properties:
      SubnetId: !Ref PublicSubnetTwo
      RouteTableId: !Ref PublicRouteTable

  # ECS Resources
  ECSCluster:
    Type: AWS::ECS::Cluster

  # A role used to allow AWS Autoscaling to inspect stats and adjust scaleable targets
  # on your AWS account
  AutoscalingRole:
    Type: AWS::IAM::Role
    Properties:
      AssumeRolePolicyDocument:
        Statement:
          - Effect: Allow
            Principal:
              Service: [application-autoscaling.amazonaws.com]
            Action: ['sts:AssumeRole']
      Path: /
      Policies:
        - PolicyName: service-autoscaling
          PolicyDocument:
            Statement:
              - Effect: Allow
                Action:
                  - 'application-autoscaling:*'
                  - 'cloudwatch:DescribeAlarms'
                  - 'cloudwatch:PutMetricAlarm'
                  - 'ecs:DescribeServices'
                  - 'ecs:UpdateService'
                Resource: '*'

  # This is an IAM role which authorizes ECS to manage resources on your
  # account on your behalf, such as updating your load balancer with the
  # details of where your containers are, so that traffic can reach your
  # containers.
  ECSRole:
    Type: AWS::IAM::Role
    Properties:
      AssumeRolePolicyDocument:
        Statement:
          - Effect: Allow
            Principal:
              Service: [ecs.amazonaws.com]
            Action: ['sts:AssumeRole']
      Path: /
      Policies:
        - PolicyName: ecs-service
          PolicyDocument:
            Statement:
              - Effect: Allow
                Action:
                  # Rules which allow ECS to attach network interfaces to instances
                  # on your behalf in order for awsvpc networking mode to work right
                  - 'ec2:AttachNetworkInterface'
                  - 'ec2:CreateNetworkInterface'
                  - 'ec2:CreateNetworkInterfacePermission'
                  - 'ec2:DeleteNetworkInterface'
                  - 'ec2:DeleteNetworkInterfacePermission'
                  - 'ec2:Describe*'
                  - 'ec2:DetachNetworkInterface'

                  # Rules which allow ECS to update load balancers on your behalf
                  # with the information sabout how to send traffic to your containers
                  - 'elasticloadbalancing:DeregisterInstancesFromLoadBalancer'
                  - 'elasticloadbalancing:DeregisterTargets'
                  - 'elasticloadbalancing:Describe*'
                  - 'elasticloadbalancing:RegisterInstancesWithLoadBalancer'
                  - 'elasticloadbalancing:RegisterTargets'
                Resource: '*'

  # This is a role which is used by the ECS tasks themselves.
  ECSTaskExecutionRole:
    Type: AWS::IAM::Role
    Properties:
      AssumeRolePolicyDocument:
        Statement:
          - Effect: Allow
            Principal:
              Service: [ecs-tasks.amazonaws.com]
            Action: ['sts:AssumeRole']
      Path: /
      Policies:
        - PolicyName: AmazonECSTaskExecutionRolePolicy
          PolicyDocument:
            Statement:
              - Effect: Allow
                Action:
                  # Allow the use of secret manager
                  - 'secretsmanager:GetSecretValue'
                  - 'kms:Decrypt'

                  # Allow the ECS Tasks to download images from ECR
                  - 'ecr:GetAuthorizationToken'
                  - 'ecr:BatchCheckLayerAvailability'
                  - 'ecr:GetDownloadUrlForLayer'
                  - 'ecr:BatchGetImage'

                  # Allow the ECS tasks to upload logs to CloudWatch
                  - 'logs:CreateLogStream'
                  - 'logs:PutLogEvents'
                Resource: '*'

  DeleteCFNLambdaExecutionRole:
    Type: 'AWS::IAM::Role'
    Properties:
      AssumeRolePolicyDocument:
        Version: '2012-10-17'
        Statement:
          - Effect: 'Allow'
            Principal:
              Service: ['lambda.amazonaws.com']
            Action: 'sts:AssumeRole'
      Path: '/'
      Policies:
        - PolicyName: DeleteCFNLambdaExecutionRole
          PolicyDocument:
            Version: '2012-10-17'
            Statement:
              - Effect: 'Allow'
                Action:
                  - 'logs:CreateLogGroup'
                  - 'logs:CreateLogStream'
                  - 'logs:PutLogEvents'
                Resource: 'arn:aws:logs:*:*:*'
              - Effect: 'Allow'
                Action:
                  - 'cloudformation:DeleteStack'
                  - 'kinesis:DeleteStream'
                  - 'secretsmanager:DeleteSecret'
                  - 'kinesis:DescribeStreamSummary'
                  - 'logs:DeleteLogGroup'
                  - 'logs:DeleteSubscriptionFilter'
                  - 'ecs:DeregisterTaskDefinition'
                  - 'lambda:DeleteFunction'
                  - 'lambda:InvokeFunction'
                  - 'events:RemoveTargets'
                  - 'events:DeleteRule'
                  - 'lambda:RemovePermission'
                Resource: '*'

  ### cloud watch to kinesis role
  CloudWatchIAMRole:
    Type: AWS::IAM::Role
    Properties:
      AssumeRolePolicyDocument:
        Statement:
          - Effect: Allow
            Principal:
              Service: [logs.amazonaws.com]
            Action: ['sts:AssumeRole']
      Path: /
      Policies:
        - PolicyName: service-autoscaling
          PolicyDocument:
            Statement:
              - Effect: Allow
                Action:
                  - 'kinesis:PutRecord'
                Resource: '*'

  #####################EFS#####################
  EfsFileStorage:
    Type: 'AWS::EFS::FileSystem'
    Properties:
      BackupPolicy:
        Status: ENABLED
      PerformanceMode: maxIO
      Encrypted: false

      FileSystemPolicy:
        Version: '2012-10-17'
        Statement:
          - Effect: 'Allow'
            Action:
              - 'elasticfilesystem:ClientMount'
              - 'elasticfilesystem:ClientWrite'
              - 'elasticfilesystem:ClientRootAccess'
            Principal:
              AWS: '*'

  MountTargetResource1:
    Type: AWS::EFS::MountTarget
    Properties:
      FileSystemId: !Ref EfsFileStorage
      SubnetId: !Ref PublicSubnetOne
      SecurityGroups:
        - !Ref EFSServerSecurityGroup

  MountTargetResource2:
    Type: AWS::EFS::MountTarget
    Properties:
      FileSystemId: !Ref EfsFileStorage
      SubnetId: !Ref PublicSubnetTwo
      SecurityGroups:
        - !Ref EFSServerSecurityGroup

Outputs:
  EfsFileStorageId:
    Description: 'The connection endpoint for the database.'
    Value: !Ref EfsFileStorage
    Export:
      Name: !Sub ${'${EnvironmentName}'}:EfsFileStorageId
  ClusterName:
    Description: The name of the ECS cluster
    Value: !Ref 'ECSCluster'
    Export:
      Name: !Sub${' ${EnvironmentName}'}:ClusterName
  AutoscalingRole:
    Description: The ARN of the role used for autoscaling
    Value: !GetAtt 'AutoscalingRole.Arn'
    Export:
      Name: !Sub ${'${EnvironmentName}'}:AutoscalingRole
  ECSRole:
    Description: The ARN of the ECS role
    Value: !GetAtt 'ECSRole.Arn'
    Export:
      Name: !Sub ${'${EnvironmentName}'}:ECSRole
  ECSTaskExecutionRole:
    Description: The ARN of the ECS role tsk execution role
    Value: !GetAtt 'ECSTaskExecutionRole.Arn'
    Export:
      Name: !Sub ${'${EnvironmentName}'}:ECSTaskExecutionRole

  DeleteCFNLambdaExecutionRole:
    Description: Lambda execution role for cleaning up cloud formations
    Value: !GetAtt 'DeleteCFNLambdaExecutionRole.Arn'
    Export:
      Name: !Sub ${'${EnvironmentName}'}:DeleteCFNLambdaExecutionRole

  CloudWatchIAMRole:
    Description: The ARN of the CloudWatch role for subscription filter
    Value: !GetAtt 'CloudWatchIAMRole.Arn'
    Export:
      Name: !Sub ${'${EnvironmentName}'}:CloudWatchIAMRole
  VpcId:
    Description: The ID of the VPC that this stack is deployed in
    Value: !Ref 'VPC'
    Export:
      Name: !Sub ${'${EnvironmentName}'}:VpcId
  PublicSubnetOne:
    Description: Public subnet one
    Value: !Ref 'PublicSubnetOne'
    Export:
      Name: !Sub ${'${EnvironmentName}'}:PublicSubnetOne
  PublicSubnetTwo:
    Description: Public subnet two
    Value: !Ref 'PublicSubnetTwo'
    Export:
      Name: !Sub ${'${EnvironmentName}'}:PublicSubnetTwo
  ContainerSecurityGroup:
    Description: A security group used to allow Fargate containers to receive traffic
    Value: !Ref 'ContainerSecurityGroup'
    Export:
      Name: !Sub ${'${EnvironmentName}'}:ContainerSecurityGroup
`;
}
