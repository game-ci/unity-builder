export class CleanupCronFormation {
  public static readonly formation: string = `AWSTemplateFormatVersion: '2010-09-09'
Description: Schedule automatic deletion of CloudFormation stacks
Metadata:
  AWS::CloudFormation::Interface:
    ParameterGroups:
      - Label:
          default: Input configuration
        Parameters:
          - StackName
          - TTL
    ParameterLabels:
      StackName:
        default: Stack name
      TTL:
        default: Time-to-live
Parameters:
  EnvironmentName:
    Type: String
    Default: development
    Description: 'Your deployment environment: DEV, QA , PROD'
  BUILDGUID:
    Type: String
    Default: ''
  StackName:
    Type: String
    Description: Stack name that will be deleted.
  DeleteStackName:
    Type: String
    Description: Stack name that will be deleted.
  TTL:
    Type: Number
    Description: Time-to-live in minutes for the stack.
Resources:
  DeleteCFNLambda:
    Type: "AWS::Lambda::Function"
    Properties:
      FunctionName: !Join [ "", [ 'DeleteCFNLambda', !Ref BUILDGUID ] ]
      Code:
        ZipFile: |
          import boto3
          import os
          import json

          stack_name = os.environ['stackName']
          delete_stack_name = os.environ['deleteStackName']

          def delete_cfn(stack_name):
              try:
                  cfn = boto3.resource('cloudformation')
                  stack = cfn.Stack(stack_name)
                  stack.delete()
                  return "SUCCESS"
              except:
                  return "ERROR"

          def handler(event, context):
              print("Received event:")
              print(json.dumps(event))
              result = delete_cfn(stack_name)
              delete_cfn(delete_stack_name)
              return result
      Environment:
        Variables:
          stackName: !Ref 'StackName'
          deleteStackName: !Ref 'DeleteStackName'
      Handler: "index.handler"
      Runtime: "python3.9"
      Timeout: "5"
      Role:
       'Fn::ImportValue': !Sub '\${EnvironmentName}:DeleteCFNLambdaExecutionRole'
  DeleteStackEventRule:
     DependsOn:
       - DeleteCFNLambda
       - GenerateCronExpression
     Type: "AWS::Events::Rule"
     Properties:
       Name: !Join [ "", [ 'DeleteStackEventRule', !Ref BUILDGUID ] ]
       Description: Delete stack event
       ScheduleExpression: !GetAtt GenerateCronExpression.cron_exp
       State: "ENABLED"
       Targets:
          -
            Arn: !GetAtt DeleteCFNLambda.Arn
            Id: 'DeleteCFNLambda'
  PermissionForDeleteCFNLambda:
    Type: "AWS::Lambda::Permission"
    DependsOn:
      - DeleteStackEventRule
    Properties:
      FunctionName: !Join [ "", [ 'DeleteCFNLambda', !Ref BUILDGUID ] ]
      Action: "lambda:InvokeFunction"
      Principal: "events.amazonaws.com"
      SourceArn: !GetAtt DeleteStackEventRule.Arn
  GenerateCronExpLambda:
    Type: "AWS::Lambda::Function"
    Properties:
      FunctionName: !Join [ "", [ 'GenerateCronExpressionLambda', !Ref BUILDGUID ] ]
      Code:
        ZipFile: |
          from datetime import datetime, timedelta
          import os
          import logging
          import json
          import cfnresponse

          def deletion_time(ttl):
              delete_at_time = datetime.now() + timedelta(minutes=int(ttl))
              hh = delete_at_time.hour
              mm = delete_at_time.minute
              yyyy = delete_at_time.year
              month = delete_at_time.month
              dd = delete_at_time.day
              # minutes hours day month day-of-week year
              cron_exp = "cron({} {} {} {} ? {})".format(mm, hh, dd, month, yyyy)
              return cron_exp

          def handler(event, context):
            print('Received event: %s' % json.dumps(event))
            status = cfnresponse.SUCCESS
            try:
                if event['RequestType'] == 'Delete':
                    cfnresponse.send(event, context, status, {})
                else:
                    ttl = event['ResourceProperties']['ttl']
                    responseData = {}
                    responseData['cron_exp'] = deletion_time(ttl)
                    cfnresponse.send(event, context, cfnresponse.SUCCESS, responseData)
            except Exception as e:
                logging.error('Exception: %s' % e, exc_info=True)
                status = cfnresponse.FAILED
                cfnresponse.send(event, context, status, {}, None)
      Handler: "index.handler"
      Runtime: "python3.9"
      Timeout: "5"
      Role:
       'Fn::ImportValue': !Sub '\${EnvironmentName}:DeleteCFNLambdaExecutionRole'
  GenerateCronExpression:
    Type: "Custom::GenerateCronExpression"
    Version: "1.0"
    Properties:
      Name: !Join [ "", [ 'GenerateCronExpression', !Ref BUILDGUID ] ]
      ServiceToken: !GetAtt GenerateCronExpLambda.Arn
      ttl: !Ref 'TTL'
`;
}
