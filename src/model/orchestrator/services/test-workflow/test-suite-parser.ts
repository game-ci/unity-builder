import fs from 'node:fs';
import YAML from 'yaml';
import { TestSuiteDefinition, TestRunDefinition } from './test-workflow-types';

/**
 * Parses and validates YAML-based test suite definition files.
 * Handles dependency resolution (topological sort) for ordered test run execution.
 */
export class TestSuiteParser {
  /**
   * Read and parse a YAML test suite definition file.
   * Validates the structure and returns a typed TestSuiteDefinition.
   */
  static parseSuiteFile(filePath: string): TestSuiteDefinition {
    if (!fs.existsSync(filePath)) {
      throw new Error(`Test suite file not found: ${filePath}`);
    }

    const content = fs.readFileSync(filePath, 'utf8');
    const parsed = YAML.parse(content);

    if (!parsed || typeof parsed !== 'object') {
      throw new Error(`Invalid YAML in test suite file: ${filePath}`);
    }

    if (!parsed.name || typeof parsed.name !== 'string') {
      throw new Error(`Test suite must have a 'name' field (string): ${filePath}`);
    }

    if (!Array.isArray(parsed.runs) || parsed.runs.length === 0) {
      throw new Error(`Test suite must have a non-empty 'runs' array: ${filePath}`);
    }

    const suite: TestSuiteDefinition = {
      name: parsed.name,
      description: parsed.description,
      runs: parsed.runs.map((run: any) => TestSuiteParser.parseRun(run)),
    };

    const errors = TestSuiteParser.validateSuite(suite);
    if (errors.length > 0) {
      throw new Error(`Test suite validation failed:\n  ${errors.join('\n  ')}`);
    }

    return suite;
  }

  /**
   * Parse a single run definition from raw YAML data.
   */
  private static parseRun(raw: any): TestRunDefinition {
    if (!raw || typeof raw !== 'object') {
      throw new Error(`Each run must be an object`);
    }

    if (!raw.name || typeof raw.name !== 'string') {
      throw new Error(`Each run must have a 'name' field (string)`);
    }

    const run: TestRunDefinition = {
      name: raw.name,
    };

    if (raw.needs !== undefined) {
      if (!Array.isArray(raw.needs)) {
        throw new Error(`Run '${raw.name}': 'needs' must be an array of strings`);
      }
      run.needs = raw.needs;
    }

    if (raw.editMode !== undefined) {
      run.editMode = Boolean(raw.editMode);
    }

    if (raw.playMode !== undefined) {
      run.playMode = Boolean(raw.playMode);
    }

    if (raw.builtClient !== undefined) {
      run.builtClient = Boolean(raw.builtClient);
    }

    if (raw.builtClientPath !== undefined) {
      run.builtClientPath = String(raw.builtClientPath);
    }

    if (raw.filters !== undefined) {
      if (typeof raw.filters !== 'object' || Array.isArray(raw.filters)) {
        throw new Error(`Run '${raw.name}': 'filters' must be a key-value object`);
      }
      run.filters = {};
      for (const [key, value] of Object.entries(raw.filters)) {
        run.filters[key] = String(value);
      }
    }

    if (raw.timeout !== undefined) {
      const timeout = Number(raw.timeout);
      if (Number.isNaN(timeout) || timeout <= 0) {
        throw new Error(`Run '${raw.name}': 'timeout' must be a positive number`);
      }
      run.timeout = timeout;
    }

    return run;
  }

  /**
   * Resolve run execution order via topological sort based on 'needs' dependencies.
   * Returns an array of parallel groups -- each group contains runs that can execute concurrently.
   * Runs within the same group have no inter-dependencies.
   */
  static resolveRunOrder(suite: TestSuiteDefinition): TestRunDefinition[][] {
    const runMap = new Map<string, TestRunDefinition>();
    for (const run of suite.runs) {
      runMap.set(run.name, run);
    }

    // Build adjacency: inDegree counts and dependents map
    const inDegree = new Map<string, number>();
    const dependents = new Map<string, string[]>();

    for (const run of suite.runs) {
      if (!inDegree.has(run.name)) {
        inDegree.set(run.name, 0);
      }
      if (!dependents.has(run.name)) {
        dependents.set(run.name, []);
      }

      if (run.needs) {
        for (const dep of run.needs) {
          inDegree.set(run.name, (inDegree.get(run.name) ?? 0) + 1);
          if (!dependents.has(dep)) {
            dependents.set(dep, []);
          }
          dependents.get(dep)!.push(run.name);
        }
      }
    }

    // Kahn's algorithm producing parallel layers
    const groups: TestRunDefinition[][] = [];
    let ready = suite.runs.filter((r) => (inDegree.get(r.name) ?? 0) === 0);
    let processed = 0;

    while (ready.length > 0) {
      groups.push(ready);
      processed += ready.length;

      const nextReady: TestRunDefinition[] = [];
      for (const run of ready) {
        for (const dep of dependents.get(run.name) ?? []) {
          const newDegree = (inDegree.get(dep) ?? 1) - 1;
          inDegree.set(dep, newDegree);
          if (newDegree === 0) {
            nextReady.push(runMap.get(dep)!);
          }
        }
      }
      ready = nextReady;
    }

    if (processed !== suite.runs.length) {
      throw new Error(`Circular dependency detected in test suite '${suite.name}'`);
    }

    return groups;
  }

  /**
   * Validate a parsed test suite definition.
   * Returns an array of validation error messages (empty = valid).
   */
  static validateSuite(suite: TestSuiteDefinition): string[] {
    const errors: string[] = [];
    const runNames = new Set<string>();

    // Check for duplicate run names
    for (const run of suite.runs) {
      if (runNames.has(run.name)) {
        errors.push(`Duplicate run name: '${run.name}'`);
      }
      runNames.add(run.name);
    }

    // Check that all 'needs' references exist
    for (const run of suite.runs) {
      if (run.needs) {
        for (const dep of run.needs) {
          if (!runNames.has(dep)) {
            errors.push(`Run '${run.name}' depends on unknown run '${dep}'`);
          }
        }

        // Self-dependency
        if (run.needs.includes(run.name)) {
          errors.push(`Run '${run.name}' depends on itself`);
        }
      }
    }

    // Check that at least one test mode is specified per run
    for (const run of suite.runs) {
      if (!run.editMode && !run.playMode && !run.builtClient) {
        errors.push(`Run '${run.name}' must specify at least one of: editMode, playMode, builtClient`);
      }
    }

    // Detect circular dependencies via DFS
    const circularError = TestSuiteParser.detectCircularDependencies(suite);
    if (circularError) {
      errors.push(circularError);
    }

    return errors;
  }

  /**
   * Detect circular dependencies using DFS cycle detection.
   */
  private static detectCircularDependencies(suite: TestSuiteDefinition): string | null {
    const adjacency = new Map<string, string[]>();
    for (const run of suite.runs) {
      adjacency.set(run.name, run.needs ?? []);
    }

    const visited = new Set<string>();
    const visiting = new Set<string>();

    const dfs = (node: string, path: string[]): string | null => {
      if (visiting.has(node)) {
        const cycleStart = path.indexOf(node);
        const cycle = path.slice(cycleStart).concat(node);
        return `Circular dependency: ${cycle.join(' -> ')}`;
      }
      if (visited.has(node)) {
        return null;
      }

      visiting.add(node);
      path.push(node);

      for (const dep of adjacency.get(node) ?? []) {
        if (adjacency.has(dep)) {
          const result = dfs(dep, [...path]);
          if (result) return result;
        }
      }

      visiting.delete(node);
      visited.add(node);
      return null;
    };

    for (const run of suite.runs) {
      const result = dfs(run.name, []);
      if (result) return result;
    }

    return null;
  }
}
