import OrchestratorLogger from '../../services/core/orchestrator-logger';
import { CloudFormation, DescribeStackEventsCommand } from '@aws-sdk/client-cloudformation';
import * as core from '@actions/core';
import Orchestrator from '../../orchestrator';

export class AWSError {
  static async handleStackCreationFailure(error: any, CF: CloudFormation, taskDefStackName: string) {
    OrchestratorLogger.log('aws error: ');
    core.error(JSON.stringify(error, undefined, 4));
    if (Orchestrator.buildParameters.orchestratorDebug) {
      OrchestratorLogger.log('Getting events and resources for task stack');
      const events = (await CF.send(new DescribeStackEventsCommand({ StackName: taskDefStackName }))).StackEvents;
      OrchestratorLogger.log(JSON.stringify(events, undefined, 4));
    }
  }
}
