import OrchestratorLogger from '../services/core/orchestrator-logger';
import * as core from '@actions/core';
import Orchestrator from '../orchestrator';
import OrchestratorSecret from '../options/orchestrator-secret';
import BuildParameters from '../../build-parameters';

export class OrchestratorError {
  public static async handleException(error: unknown, buildParameters: BuildParameters, secrets: OrchestratorSecret[]) {
    OrchestratorLogger.error(JSON.stringify(error, undefined, 4));
    core.setFailed('Orchestrator failed');
    if (Orchestrator.Provider !== undefined) {
      await Orchestrator.Provider.cleanupWorkflow(buildParameters, buildParameters.branch, secrets);
    }
  }
}
