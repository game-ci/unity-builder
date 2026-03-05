import fs from 'node:fs';
import path from 'node:path';
import { TestResult, TestFailure } from './test-workflow-types';

/**
 * Parses test result files (JUnit XML, Unity JSON) and generates structured
 * summary reports. Supports writing results in multiple formats for CI
 * integration (GitHub Checks, artifact upload).
 */
export class TestResultReporter {
  /**
   * Parse a JUnit XML test result file into a TestResult.
   * JUnit XML is the standard format produced by Unity's test runner.
   */
  static parseJUnitResults(xmlPath: string): TestResult {
    if (!fs.existsSync(xmlPath)) {
      throw new Error(`JUnit result file not found: ${xmlPath}`);
    }

    const content = fs.readFileSync(xmlPath, 'utf8');
    return TestResultReporter.parseJUnitXml(content);
  }

  /**
   * Parse JUnit XML content string into a TestResult.
   */
  static parseJUnitXml(xmlContent: string): TestResult {
    // Extract the testsuite opening tag
    const suiteTagMatch = xmlContent.match(/<testsuite\s[^>]*>/);

    let runName = 'unknown';
    let totalTests = 0;
    let failureCount = 0;
    let skippedCount = 0;
    let duration = 0;

    if (suiteTagMatch) {
      const tag = suiteTagMatch[0];

      // Extract individual attributes -- order-independent
      const nameMatch = tag.match(/\sname="([^"]*)"/);
      const testsMatch = tag.match(/\stests="(\d+)"/);
      const failuresMatch = tag.match(/\sfailures="(\d+)"/);
      const skippedMatch = tag.match(/\sskipped="(\d+)"/);
      const timeMatch = tag.match(/\stime="([^"]*)"/);

      runName = nameMatch ? nameMatch[1] : 'unknown';
      totalTests = testsMatch ? Number.parseInt(testsMatch[1], 10) : 0;
      failureCount = failuresMatch ? Number.parseInt(failuresMatch[1], 10) : 0;
      skippedCount = skippedMatch ? Number.parseInt(skippedMatch[1], 10) : 0;
      duration = timeMatch ? Number.parseFloat(timeMatch[1]) : 0;
    }

    // Extract individual test failures by splitting into testcase blocks
    const failures: TestFailure[] = [];
    const testcasePattern = /<testcase\s[^>]*>[\s\S]*?<\/testcase>/g;

    let tcMatch;
    while ((tcMatch = testcasePattern.exec(xmlContent)) !== null) {
      const block = tcMatch[0];

      // Only process testcases that contain a <failure> element
      if (!block.includes('<failure')) {
        continue;
      }

      // Extract testcase attributes (order-independent)
      const tcTag = block.match(/<testcase\s[^>]*>/);
      if (!tcTag) continue;

      const cnMatch = tcTag[0].match(/\sclassname="([^"]*)"/);
      const tnMatch = tcTag[0].match(/\sname="([^"]*)"/);

      const className = cnMatch ? cnMatch[1] : 'unknown';
      const testName = tnMatch ? tnMatch[1] : 'unknown';

      // Extract failure message
      const failTag = block.match(/<failure\s[^>]*>/);
      const msgMatch = failTag ? failTag[0].match(/\smessage="([^"]*)"/) : null;
      const message = msgMatch ? msgMatch[1] : 'Test failed';

      // Extract stack trace from CDATA or text content
      const cdataMatch = block.match(/<failure[^>]*>[\s\S]*?<!\[CDATA\[([\s\S]*?)\]\]>/);
      const textMatch = !cdataMatch ? block.match(/<failure[^>]*>([^<]*)<\/failure>/) : null;
      const stackTrace = cdataMatch ? cdataMatch[1].trim() : textMatch ? textMatch[1].trim() : undefined;

      failures.push({ testName, className, message, stackTrace: stackTrace || undefined });
    }

    const passed = totalTests - failureCount - skippedCount;

    return {
      runName,
      passed: Math.max(0, passed),
      failed: failureCount,
      skipped: skippedCount,
      duration,
      failures,
    };
  }

  /**
   * Parse a Unity JSON test result file into a TestResult.
   */
  static parseJsonResults(jsonPath: string): TestResult {
    if (!fs.existsSync(jsonPath)) {
      throw new Error(`JSON result file not found: ${jsonPath}`);
    }

    const content = fs.readFileSync(jsonPath, 'utf8');
    const data = JSON.parse(content);

    return TestResultReporter.parseJsonData(data);
  }

  /**
   * Parse Unity JSON test result data into a TestResult.
   */
  static parseJsonData(data: any): TestResult {
    const runName = data.name ?? data.suiteName ?? 'unknown';
    const passed = data.passed ?? data.passCount ?? 0;
    const failed = data.failed ?? data.failCount ?? 0;
    const skipped = data.skipped ?? data.skipCount ?? data.inconclusive ?? 0;
    const duration = data.duration ?? data.time ?? 0;

    const failures: TestFailure[] = [];

    // Unity test results may have a 'testResults' or 'results' array
    const results = data.testResults ?? data.results ?? data.children ?? [];

    if (Array.isArray(results)) {
      for (const result of results) {
        TestResultReporter.extractFailures(result, failures);
      }
    }

    return {
      runName,
      passed,
      failed,
      skipped,
      duration,
      failures,
    };
  }

  /**
   * Recursively extract failures from nested Unity test result JSON.
   */
  private static extractFailures(node: any, failures: TestFailure[]): void {
    if (!node) return;

    const status = (node.result ?? node.status ?? '').toLowerCase();
    if (status === 'failed' || status === 'failure') {
      failures.push({
        testName: node.name ?? node.testName ?? 'unknown',
        className: node.className ?? node.fullName ?? node.name ?? 'unknown',
        message: node.message ?? node.output ?? 'Test failed',
        stackTrace: node.stackTrace ?? node.trace ?? undefined,
      });
    }

    // Recurse into children (Unity nests test fixtures inside suites)
    const children = node.children ?? node.testResults ?? node.results ?? [];
    if (Array.isArray(children)) {
      for (const child of children) {
        TestResultReporter.extractFailures(child, failures);
      }
    }
  }

  /**
   * Generate a markdown summary table from an array of test results.
   */
  static generateSummary(results: TestResult[]): string {
    if (results.length === 0) {
      return 'No test results available.';
    }

    const lines: string[] = [];
    lines.push('## Test Results Summary');
    lines.push('');
    lines.push('| Run | Passed | Failed | Skipped | Duration |');
    lines.push('|-----|--------|--------|---------|----------|');

    let totalPassed = 0;
    let totalFailed = 0;
    let totalSkipped = 0;
    let totalDuration = 0;

    for (const result of results) {
      const status = result.failed > 0 ? 'X' : 'OK';
      const durationStr = TestResultReporter.formatDuration(result.duration);
      lines.push(
        `| ${status} ${result.runName} | ${result.passed} | ${result.failed} | ${result.skipped} | ${durationStr} |`,
      );
      totalPassed += result.passed;
      totalFailed += result.failed;
      totalSkipped += result.skipped;
      totalDuration += result.duration;
    }

    lines.push(
      `| **Total** | **${totalPassed}** | **${totalFailed}** | **${totalSkipped}** | **${TestResultReporter.formatDuration(
        totalDuration,
      )}** |`,
    );
    lines.push('');

    // Append failure details if any
    const allFailures = results.flatMap((r) => r.failures.map((f) => ({ ...f, run: r.runName })));
    if (allFailures.length > 0) {
      lines.push('### Failures');
      lines.push('');
      for (const failure of allFailures) {
        lines.push(`**${failure.run}** - \`${failure.className}.${failure.testName}\``);
        lines.push(`> ${failure.message}`);
        if (failure.stackTrace) {
          lines.push('```');
          lines.push(failure.stackTrace.slice(0, 500));
          lines.push('```');
        }
        lines.push('');
      }
    }

    return lines.join('\n');
  }

  /**
   * Write test results to the output path in the specified format(s).
   */
  static writeResults(results: TestResult[], outputPath: string, format: 'junit' | 'json' | 'both'): void {
    if (!fs.existsSync(outputPath)) {
      fs.mkdirSync(outputPath, { recursive: true });
    }

    if (format === 'json' || format === 'both') {
      const jsonPath = path.join(outputPath, 'test-results.json');
      fs.writeFileSync(jsonPath, JSON.stringify(results, null, 2), 'utf8');
    }

    if (format === 'junit' || format === 'both') {
      const junitPath = path.join(outputPath, 'test-results.xml');
      const xml = TestResultReporter.toJUnitXml(results);
      fs.writeFileSync(junitPath, xml, 'utf8');
    }

    // Always write markdown summary
    const summaryPath = path.join(outputPath, 'test-summary.md');
    const summary = TestResultReporter.generateSummary(results);
    fs.writeFileSync(summaryPath, summary, 'utf8');
  }

  /**
   * Convert TestResult array to JUnit XML format.
   */
  private static toJUnitXml(results: TestResult[]): string {
    const lines: string[] = [];
    lines.push('<?xml version="1.0" encoding="UTF-8"?>');
    lines.push('<testsuites>');

    for (const result of results) {
      const total = result.passed + result.failed + result.skipped;
      lines.push(
        `  <testsuite name="${TestResultReporter.escapeXml(result.runName)}" tests="${total}" failures="${
          result.failed
        }" skipped="${result.skipped}" time="${result.duration.toFixed(3)}">`,
      );

      // Write failure test cases
      for (const failure of result.failures) {
        lines.push(
          `    <testcase classname="${TestResultReporter.escapeXml(
            failure.className,
          )}" name="${TestResultReporter.escapeXml(failure.testName)}">`,
        );
        lines.push(`      <failure message="${TestResultReporter.escapeXml(failure.message)}">`);
        if (failure.stackTrace) {
          lines.push(`        <![CDATA[${failure.stackTrace}]]>`);
        }
        lines.push('      </failure>');
        lines.push('    </testcase>');
      }

      lines.push('  </testsuite>');
    }

    lines.push('</testsuites>');
    return lines.join('\n');
  }

  /**
   * Escape special XML characters.
   */
  private static escapeXml(str: string): string {
    return str
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&apos;');
  }

  /**
   * Format a duration in seconds to a human-readable string.
   */
  private static formatDuration(seconds: number): string {
    if (seconds < 60) {
      return `${seconds.toFixed(1)}s`;
    }
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    return `${minutes}m ${remainingSeconds.toFixed(0)}s`;
  }
}
