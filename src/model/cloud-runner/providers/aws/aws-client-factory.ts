import { CloudFormation } from '@aws-sdk/client-cloudformation';
import { ECS } from '@aws-sdk/client-ecs';
import { Kinesis } from '@aws-sdk/client-kinesis';
import { CloudWatchLogs } from '@aws-sdk/client-cloudwatch-logs';
import { S3 } from '@aws-sdk/client-s3';
import { Input } from '../../..';
import CloudRunnerOptions from '../../options/cloud-runner-options';

export class AwsClientFactory {
  private static cloudFormation: CloudFormation;
  private static ecs: ECS;
  private static kinesis: Kinesis;
  private static cloudWatchLogs: CloudWatchLogs;
  private static s3: S3;

  static getCloudFormation(): CloudFormation {
    if (!this.cloudFormation) {
      this.cloudFormation = new CloudFormation({
        region: Input.region,
        endpoint: CloudRunnerOptions.awsCloudFormationEndpoint,
      });
    }

    return this.cloudFormation;
  }

  static getECS(): ECS {
    if (!this.ecs) {
      this.ecs = new ECS({
        region: Input.region,
        endpoint: CloudRunnerOptions.awsEcsEndpoint,
      });
    }

    return this.ecs;
  }

  static getKinesis(): Kinesis {
    if (!this.kinesis) {
      this.kinesis = new Kinesis({
        region: Input.region,
        endpoint: CloudRunnerOptions.awsKinesisEndpoint,
      });
    }

    return this.kinesis;
  }

  static getCloudWatchLogs(): CloudWatchLogs {
    if (!this.cloudWatchLogs) {
      this.cloudWatchLogs = new CloudWatchLogs({
        region: Input.region,
        endpoint: CloudRunnerOptions.awsCloudWatchLogsEndpoint,
      });
    }

    return this.cloudWatchLogs;
  }

  static getS3(): S3 {
    if (!this.s3) {
      this.s3 = new S3({
        region: Input.region,
        endpoint: CloudRunnerOptions.awsS3Endpoint,
        forcePathStyle: true,
      });
    }

    return this.s3;
  }
}
