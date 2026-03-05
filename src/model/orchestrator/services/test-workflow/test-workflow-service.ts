import { execSync } from 'node:child_process';
import path from 'node:path';
import * as core from '@actions/core';
import BuildParameters from '../../../build-parameters';
import { TestSuiteParser } from './test-suite-parser';
import { TaxonomyFilterService } from './taxonomy-filter-service';
import { TestResultReporter } from './test-result-reporter';
import { TestRunDefinition, TestResult } from './test-workflow-types';

/**
 * Main entry point for the test workflow engine.
 * Orchestrates parsing of YAML suite definitions, resolving run order,
 * executing test runs via Unity CLI, and collecting structured results.
 */
export class TestWorkflowService {
  /**
   * Execute a full test suite from a YAML definition file.
   * Parses the suite, resolves dependency order, executes each parallel
   * group sequentially (runs within a group execute concurrently), and
   * collects all results.
   */
  static async executeTestSuite(suitePath: string, params: BuildParameters): Promise<TestResult[]> {
    core.info(`[TestWorkflow] Loading test suite from: ${suitePath}`);

    const suite = TestSuiteParser.parseSuiteFile(suitePath);
    core.info(`[TestWorkflow] Suite '${suite.name}' loaded with ${suite.runs.length} run(s)`);

    if (suite.description) {
      core.info(`[TestWorkflow] Description: ${suite.description}`);
    }

    const groups = TestSuiteParser.resolveRunOrder(suite);
    core.info(`[TestWorkflow] Resolved into ${groups.length} execution group(s)`);

    const allResults: TestResult[] = [];
    let groupIndex = 0;

    for (const group of groups) {
      groupIndex++;
      const runNames = group.map((r) => r.name).join(', ');
      core.info(`[TestWorkflow] Executing group ${groupIndex}/${groups.length}: [${runNames}]`);

      // Execute runs within a group concurrently
      const groupResults = await Promise.all(group.map((run) => TestWorkflowService.executeTestRun(run, params)));

      allResults.push(...groupResults);

      // Check for failures -- if any run in this group failed, log a warning
      // but continue to the next group (fail-forward for maximum feedback)
      const failedRuns = groupResults.filter((r) => r.failed > 0);
      if (failedRuns.length > 0) {
        const failedNames = failedRuns.map((r) => r.runName).join(', ');
        core.warning(`[TestWorkflow] Failures detected in group ${groupIndex}: [${failedNames}]`);
      }
    }

    // Generate and output summary
    const summary = TestResultReporter.generateSummary(allResults);
    core.info(summary);

    // Write results if output path is configured
    const resultPath = params.testResultPath;
    const resultFormat = params.testResultFormat;
    if (resultPath) {
      TestResultReporter.writeResults(allResults, resultPath, resultFormat as 'junit' | 'json' | 'both');
      core.info(`[TestWorkflow] Results written to: ${resultPath}`);
    }

    return allResults;
  }

  /**
   * Execute a single test run definition.
   * Builds the Unity CLI arguments based on the run configuration (edit mode,
   * play mode, built client) and taxonomy filters, executes the command, and
   * parses the result output.
   */
  static async executeTestRun(run: TestRunDefinition, params: BuildParameters): Promise<TestResult> {
    core.info(`[TestWorkflow] Starting run: '${run.name}'`);

    const args = TestWorkflowService.buildUnityArgs(run, params);
    const timeoutMs = (run.timeout ?? 600) * 1000;

    core.info(`[TestWorkflow] Unity args: ${args}`);

    const startTime = Date.now();

    try {
      const resultDir = path.join(params.testResultPath ?? './test-results', run.name);
      const resultFile = path.join(resultDir, 'results.xml');

      // Build the full Unity command
      const unityPath = TestWorkflowService.resolveUnityPath(params);
      const command = `"${unityPath}" ${args} -testResults "${resultFile}"`;

      core.info(`[TestWorkflow] Executing: ${command}`);

      execSync(command, {
        timeout: timeoutMs,
        stdio: 'pipe',
        encoding: 'utf8',
        cwd: params.projectPath || process.cwd(),
      });

      const duration = (Date.now() - startTime) / 1000;

      // Parse the result file
      try {
        const result = TestResultReporter.parseJUnitResults(resultFile);
        result.runName = run.name;
        result.duration = duration;
        return result;
      } catch {
        // Result file may not exist if Unity exited early
        core.warning(`[TestWorkflow] Could not parse results for run '${run.name}' -- result file may be missing`);
        return {
          runName: run.name,
          passed: 0,
          failed: 0,
          skipped: 0,
          duration,
          failures: [],
        };
      }
    } catch (error: any) {
      const duration = (Date.now() - startTime) / 1000;
      const isTimeout = error.killed || error.signal === 'SIGTERM';

      if (isTimeout) {
        core.error(`[TestWorkflow] Run '${run.name}' timed out after ${run.timeout}s`);
      } else {
        core.error(`[TestWorkflow] Run '${run.name}' failed: ${error.message}`);
      }

      // Try to parse partial results even on failure
      const resultDir = path.join(params.testResultPath ?? './test-results', run.name);
      const resultFile = path.join(resultDir, 'results.xml');

      try {
        const result = TestResultReporter.parseJUnitResults(resultFile);
        result.runName = run.name;
        result.duration = duration;
        return result;
      } catch {
        return {
          runName: run.name,
          passed: 0,
          failed: 1,
          skipped: 0,
          duration,
          failures: [
            {
              testName: isTimeout ? 'Timeout' : 'ExecutionError',
              className: run.name,
              message: isTimeout
                ? `Test run timed out after ${run.timeout}s`
                : error.message ?? 'Unknown execution error',
              stackTrace: error.stderr ?? undefined,
            },
          ],
        };
      }
    }
  }

  /**
   * Build Unity CLI arguments for a test run based on its configuration.
   */
  static buildUnityArgs(run: TestRunDefinition, params: BuildParameters): string {
    const args: string[] = [];

    // Batch mode and no-graphics for CI
    args.push('-batchmode');
    args.push('-nographics');

    // Project path
    if (params.projectPath) {
      args.push(`-projectPath "${params.projectPath}"`);
    }

    // Test mode
    if (run.builtClient && run.builtClientPath) {
      // Built client testing: run tests against a built player
      args.push('-runTests');
      args.push(`-testPlatform StandalonePlayer`);
      args.push(`-assemblyNames Assembly-CSharp-Tests`);
      args.push(`-builtPlayerPath "${run.builtClientPath}"`);
    } else if (run.editMode && run.playMode) {
      // Both modes: run EditMode first, then PlayMode will require a separate invocation
      // For combined mode, use EditMode (the service handles sequencing)
      args.push('-runTests');
      args.push('-testPlatform EditMode');
    } else if (run.playMode) {
      args.push('-runTests');
      args.push('-testPlatform PlayMode');
    } else if (run.editMode) {
      args.push('-runTests');
      args.push('-testPlatform EditMode');
    }

    // Apply taxonomy filters
    if (run.filters && Object.keys(run.filters).length > 0) {
      const filterArgs = TaxonomyFilterService.buildFilterArgs(run.filters);
      if (filterArgs) {
        args.push(filterArgs);
      }
    }

    // Target platform
    if (params.targetPlatform) {
      args.push(`-buildTarget ${params.targetPlatform}`);
    }

    return args.join(' ');
  }

  /**
   * Resolve the path to the Unity editor executable.
   */
  private static resolveUnityPath(params: BuildParameters): string {
    // In CI, Unity path is typically set via environment or the docker container
    const envUnityPath = process.env.UNITY_PATH ?? process.env.UNITY_EDITOR;
    if (envUnityPath) {
      return envUnityPath;
    }

    // Default paths by platform
    if (process.platform === 'win32') {
      return `C:/Program Files/Unity/Hub/Editor/${params.editorVersion}/Editor/Unity.exe`;
    }
    if (process.platform === 'darwin') {
      return `/Applications/Unity/Hub/Editor/${params.editorVersion}/Unity.app/Contents/MacOS/Unity`;
    }

    // Linux default (Docker container path)
    return '/opt/unity/Editor/Unity';
  }
}
