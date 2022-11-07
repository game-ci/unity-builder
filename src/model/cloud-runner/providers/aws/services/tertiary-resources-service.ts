import AWS from 'aws-sdk';
import Input from '../../../../input';
import CloudRunnerLogger from '../../../services/cloud-runner-logger';

export class TertiaryResourcesService {
  public static async awsListLogGroups(perResultCallback: any = false) {
    process.env.AWS_REGION = Input.region;
    const ecs = new AWS.CloudWatchLogs();
    let logStreamInput: AWS.CloudWatchLogs.DescribeLogGroupsRequest = {
      /* logGroupNamePrefix: 'game-ci' */
    };
    let logGroupsDescribe = await ecs.describeLogGroups(logStreamInput).promise();
    const logGroups = logGroupsDescribe.logGroups || [];
    while (logGroupsDescribe.nextToken) {
      logStreamInput = { /* logGroupNamePrefix: 'game-ci',*/ nextToken: logGroupsDescribe.nextToken };
      logGroupsDescribe = await ecs.describeLogGroups(logStreamInput).promise();
      logGroups.push(...(logGroupsDescribe?.logGroups || []));
    }

    CloudRunnerLogger.log(`Log Groups ${logGroups.length}`);
    for (const element of logGroups) {
      if (element.creationTime === undefined) {
        CloudRunnerLogger.log(`Skipping ${element.logGroupName} no createdAt date`);
        continue;
      }
      const ageDate: Date = new Date(Date.now() - element.creationTime);

      CloudRunnerLogger.log(
        `Task Stack ${element.logGroupName} - Age D${Math.floor(
          ageDate.getHours() / 24,
        )} H${ageDate.getHours()} M${ageDate.getMinutes()}`,
      );
      if (perResultCallback) await perResultCallback(element, element);
    }
  }
}
