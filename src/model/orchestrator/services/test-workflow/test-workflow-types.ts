export interface TestSuiteDefinition {
  name: string;
  description?: string;
  runs: TestRunDefinition[];
}

export interface TestRunDefinition {
  name: string;
  needs?: string[];
  editMode?: boolean;
  playMode?: boolean;
  builtClient?: boolean;
  builtClientPath?: string;
  filters?: Record<string, string>; // dimension -> comma-separated values or /regex/
  timeout?: number;
}

export interface TaxonomyDimension {
  name: string;
  values: string[];
}

export interface TaxonomyDefinition {
  extensible_groups: TaxonomyDimension[];
}

export interface TestResult {
  runName: string;
  passed: number;
  failed: number;
  skipped: number;
  duration: number;
  failures: TestFailure[];
}

export interface TestFailure {
  testName: string;
  className: string;
  message: string;
  stackTrace?: string;
}
