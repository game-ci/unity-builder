import { CloudFormation } from '@aws-sdk/client-cloudformation';
import { ECS } from '@aws-sdk/client-ecs';
import { Kinesis } from '@aws-sdk/client-kinesis';
import { CloudWatchLogs } from '@aws-sdk/client-cloudwatch-logs';
import { S3 } from '@aws-sdk/client-s3';
import { Input } from '../../..';
import OrchestratorOptions from '../../options/orchestrator-options';

export class AwsClientFactory {
  private static cloudFormation: CloudFormation;
  private static ecs: ECS;
  private static kinesis: Kinesis;
  private static cloudWatchLogs: CloudWatchLogs;
  private static s3: S3;

  private static getCredentials() {
    // Explicitly provide credentials from environment variables for LocalStack compatibility
    // LocalStack accepts any credentials, but the AWS SDK needs them to be explicitly set
    const accessKeyId = process.env.AWS_ACCESS_KEY_ID;
    const secretAccessKey = process.env.AWS_SECRET_ACCESS_KEY;

    if (accessKeyId && secretAccessKey) {
      return {
        accessKeyId,
        secretAccessKey,
      };
    }

    // Return undefined to let AWS SDK use default credential chain
    return;
  }

  static getCloudFormation(): CloudFormation {
    if (!this.cloudFormation) {
      this.cloudFormation = new CloudFormation({
        region: Input.region,
        endpoint: OrchestratorOptions.awsCloudFormationEndpoint,
        credentials: AwsClientFactory.getCredentials(),
      });
    }

    return this.cloudFormation;
  }

  static getECS(): ECS {
    if (!this.ecs) {
      this.ecs = new ECS({
        region: Input.region,
        endpoint: OrchestratorOptions.awsEcsEndpoint,
        credentials: AwsClientFactory.getCredentials(),
      });
    }

    return this.ecs;
  }

  static getKinesis(): Kinesis {
    if (!this.kinesis) {
      this.kinesis = new Kinesis({
        region: Input.region,
        endpoint: OrchestratorOptions.awsKinesisEndpoint,
        credentials: AwsClientFactory.getCredentials(),
      });
    }

    return this.kinesis;
  }

  static getCloudWatchLogs(): CloudWatchLogs {
    if (!this.cloudWatchLogs) {
      this.cloudWatchLogs = new CloudWatchLogs({
        region: Input.region,
        endpoint: OrchestratorOptions.awsCloudWatchLogsEndpoint,
        credentials: AwsClientFactory.getCredentials(),
      });
    }

    return this.cloudWatchLogs;
  }

  static getS3(): S3 {
    if (!this.s3) {
      this.s3 = new S3({
        region: Input.region,
        endpoint: OrchestratorOptions.awsS3Endpoint,
        forcePathStyle: true,
        credentials: AwsClientFactory.getCredentials(),
      });
    }

    return this.s3;
  }
}
