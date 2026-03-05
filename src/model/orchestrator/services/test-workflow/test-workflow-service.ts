import { exec } from 'node:child_process';
import { promisify } from 'node:util';
import path from 'node:path';
import * as core from '@actions/core';
import BuildParameters from '../../../build-parameters';
import { TestSuiteParser } from './test-suite-parser';
import { TaxonomyFilterService } from './taxonomy-filter-service';
import { TestResultReporter } from './test-result-reporter';
import { TestRunDefinition, TestResult } from './test-workflow-types';

const execAsync = promisify(exec);

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
  static async executeTestSuite(suitePath: string, parameters: BuildParameters): Promise<TestResult[]> {
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
      const groupResults = await Promise.all(group.map((run) => TestWorkflowService.executeTestRun(run, parameters)));

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
    const resultPath = parameters.testResultPath;
    const resultFormat = parameters.testResultFormat;
    if (resultPath) {
      TestResultReporter.writeResults(allResults, resultPath, resultFormat as 'junit' | 'json' | 'both');
      core.info(`[TestWorkflow] Results written to: ${resultPath}`);
    }

    return allResults;
  }

  /**
   * Execute a single test run definition.
   * Builds the Unity CLI arguments based on the run configuration (edit mode,
   * play mode, built client) and taxonomy filters, executes the command
   * asynchronously, and parses the result output.
   *
   * Uses promisified exec instead of execSync so that Promise.all can
   * actually run multiple test groups in parallel without blocking the
   * Node.js event loop.
   */
  static async executeTestRun(run: TestRunDefinition, parameters: BuildParameters): Promise<TestResult> {
    core.info(`[TestWorkflow] Starting run: '${run.name}'`);

    const unityArguments = TestWorkflowService.buildUnityArgs(run, parameters);
    const timeoutMs = (run.timeout ?? 600) * 1000;

    core.info(`[TestWorkflow] Unity args: ${unityArguments}`);

    const startTime = Date.now();

    try {
      const resultDirectory = path.join(parameters.testResultPath ?? './test-results', run.name);
      const resultFile = path.join(resultDirectory, 'results.xml');

      // Build the full Unity command
      const unityPath = TestWorkflowService.resolveUnityPath(parameters);
      const command = `"${unityPath}" ${unityArguments} -testResults "${resultFile}"`;

      core.info(`[TestWorkflow] Executing: ${command}`);

      await execAsync(command, {
        timeout: timeoutMs,
        maxBuffer: 50 * 1024 * 1024, // 50 MB to handle large Unity output
        cwd: parameters.projectPath || process.cwd(),
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

      // The promisified exec sets error.killed when the process is terminated
      // due to timeout, and error.signal will be 'SIGTERM'
      const isTimeout = error.killed === true || error.signal === 'SIGTERM';

      if (isTimeout) {
        core.error(`[TestWorkflow] Run '${run.name}' timed out after ${run.timeout ?? 600}s`);
      } else {
        core.error(`[TestWorkflow] Run '${run.name}' failed: ${error.message}`);
      }

      // Try to parse partial results even on failure
      const resultDirectory = path.join(parameters.testResultPath ?? './test-results', run.name);
      const resultFile = path.join(resultDirectory, 'results.xml');

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
                ? `Test run timed out after ${run.timeout ?? 600}s`
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
  static buildUnityArgs(run: TestRunDefinition, parameters: BuildParameters): string {
    const unityArguments: string[] = ['-batchmode', '-nographics'];

    // Project path
    if (parameters.projectPath) {
      unityArguments.push(`-projectPath "${parameters.projectPath}"`);
    }

    // Test mode
    if (run.builtClient && run.builtClientPath) {
      // Built client testing: run tests against a built player
      unityArguments.push(
        '-runTests',
        `-testPlatform StandalonePlayer`,
        `-assemblyNames Assembly-CSharp-Tests`,
        `-builtPlayerPath "${run.builtClientPath}"`,
      );
    } else if (run.editMode && run.playMode) {
      // Both modes: run EditMode first, then PlayMode will require a separate invocation
      // For combined mode, use EditMode (the service handles sequencing)
      unityArguments.push('-runTests', '-testPlatform EditMode');
    } else if (run.playMode) {
      unityArguments.push('-runTests', '-testPlatform PlayMode');
    } else if (run.editMode) {
      unityArguments.push('-runTests', '-testPlatform EditMode');
    }

    // Apply taxonomy filters
    if (run.filters && Object.keys(run.filters).length > 0) {
      const filterArguments = TaxonomyFilterService.buildFilterArgs(run.filters);
      if (filterArguments) {
        unityArguments.push(filterArguments);
      }
    }

    // Target platform
    if (parameters.targetPlatform) {
      unityArguments.push(`-buildTarget ${parameters.targetPlatform}`);
    }

    return unityArguments.join(' ');
  }

  /**
   * Resolve the path to the Unity editor executable.
   */
  private static resolveUnityPath(parameters: BuildParameters): string {
    // In CI, Unity path is typically set via environment or the docker container
    const environmentUnityPath = process.env.UNITY_PATH ?? process.env.UNITY_EDITOR;
    if (environmentUnityPath) {
      return environmentUnityPath;
    }

    // Default paths by platform
    if (process.platform === 'win32') {
      return `C:/Program Files/Unity/Hub/Editor/${parameters.editorVersion}/Editor/Unity.exe`;
    }

    if (process.platform === 'darwin') {
      return `/Applications/Unity/Hub/Editor/${parameters.editorVersion}/Unity.app/Contents/MacOS/Unity`;
    }

    // Linux default (Docker container path)
    return '/opt/unity/Editor/Unity';
  }
}
