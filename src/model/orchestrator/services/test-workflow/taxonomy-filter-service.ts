import fs from 'node:fs';
import YAML from 'yaml';
import { TaxonomyDimension, TaxonomyDefinition } from './test-workflow-types';

/**
 * Manages test taxonomy dimensions and builds filter arguments for
 * the Unity test runner CLI. Supports comma-separated value lists,
 * regex patterns (/pattern/), and hierarchical dot-notation matching.
 */
export class TaxonomyFilterService {
  /**
   * Built-in taxonomy dimensions that are always available.
   * Projects may extend these via a custom taxonomy file.
   */
  private static readonly BUILT_IN_DIMENSIONS: TaxonomyDimension[] = [
    { name: 'Scope', values: ['Unit', 'Integration', 'System', 'End To End'] },
    { name: 'Maturity', values: ['Trusted', 'Adolescent', 'Experimental'] },
    { name: 'FeedbackSpeed', values: ['Fast', 'Moderate', 'Slow'] },
    { name: 'Execution', values: ['Synchronous', 'Asynchronous', 'Coroutine'] },
    { name: 'Rigor', values: ['Strict', 'Normal', 'Relaxed'] },
    { name: 'Determinism', values: ['Deterministic', 'NonDeterministic'] },
    { name: 'IsolationLevel', values: ['Full', 'Partial', 'None'] },
  ];

  /**
   * Load taxonomy dimensions: built-in dimensions plus any custom dimensions
   * from an optional taxonomy file.
   */
  static loadTaxonomy(filePath?: string): TaxonomyDimension[] {
    const dimensions = [...TaxonomyFilterService.BUILT_IN_DIMENSIONS];

    if (filePath && fs.existsSync(filePath)) {
      const content = fs.readFileSync(filePath, 'utf8');
      const parsed = YAML.parse(content) as TaxonomyDefinition;

      if (parsed?.extensible_groups && Array.isArray(parsed.extensible_groups)) {
        for (const group of parsed.extensible_groups) {
          if (group.name && Array.isArray(group.values)) {
            // If a custom dimension has the same name as a built-in, merge values
            const existing = dimensions.find((d) => d.name === group.name);
            if (existing) {
              const existingValues = new Set(existing.values);
              for (const value of group.values) {
                if (!existingValues.has(value)) {
                  existing.values.push(value);
                }
              }
            } else {
              dimensions.push({ name: group.name, values: [...group.values] });
            }
          }
        }
      }
    }

    return dimensions;
  }

  /**
   * Convert a filter map to Unity test runner CLI args (--testFilter).
   *
   * Each filter dimension becomes a category expression. Multiple values in one
   * dimension are OR'd; multiple dimensions are AND'd. The result is a single
   * --testFilter string suitable for passing to Unity's test runner CLI.
   *
   * Regex patterns (values wrapped in /.../) are converted to category regex
   * expressions supported by the Unity test runner.
   */
  static buildFilterArgs(filters: Record<string, string>): string {
    if (!filters || Object.keys(filters).length === 0) {
      return '';
    }

    const categoryExpressions: string[] = [];

    for (const [dimension, valueSpec] of Object.entries(filters)) {
      const expression = TaxonomyFilterService.buildDimensionExpression(dimension, valueSpec);
      if (expression) {
        categoryExpressions.push(expression);
      }
    }

    if (categoryExpressions.length === 0) {
      return '';
    }

    // Unity test runner uses --testFilter with category expressions
    // Multiple dimensions are AND'd by joining with ';'
    const filterString = categoryExpressions.join(';');
    return `--testFilter "${filterString}"`;
  }

  /**
   * Build a filter expression for a single taxonomy dimension.
   */
  private static buildDimensionExpression(dimension: string, valueSpec: string): string {
    if (!valueSpec || valueSpec.trim() === '') {
      return '';
    }

    const trimmed = valueSpec.trim();

    // Check if the value is a regex pattern: /pattern/
    if (trimmed.startsWith('/') && trimmed.endsWith('/') && trimmed.length > 2) {
      const pattern = trimmed.slice(1, -1);
      return `${dimension}=~${pattern}`;
    }

    // Comma-separated values: OR'd together
    const values = trimmed
      .split(',')
      .map((v) => v.trim())
      .filter((v) => v.length > 0);

    if (values.length === 0) {
      return '';
    }

    if (values.length === 1) {
      return `${dimension}=${values[0]}`;
    }

    // Multiple values: use pipe-separated OR syntax
    return `${dimension}=${values.join('|')}`;
  }

  /**
   * Check if a test's taxonomy metadata matches the given filter criteria.
   *
   * A test matches if ALL filter dimensions match (AND across dimensions).
   * Within a single dimension, the test must match ANY of the specified values (OR).
   * Regex patterns are matched as regular expressions.
   * Hierarchical dot-notation supports prefix matching (e.g., filter "Combat.Melee"
   * matches test category "Combat.Melee.Sword").
   */
  static matchesFilter(testCategories: Record<string, string>, filters: Record<string, string>): boolean {
    for (const [dimension, valueSpec] of Object.entries(filters)) {
      const testValue = testCategories[dimension];

      // If the test has no value for this dimension, it does not match
      if (testValue === undefined || testValue === null) {
        return false;
      }

      if (!TaxonomyFilterService.matchesDimensionFilter(testValue, valueSpec)) {
        return false;
      }
    }

    return true;
  }

  /**
   * Check if a single test category value matches a dimension filter spec.
   */
  private static matchesDimensionFilter(testValue: string, valueSpec: string): boolean {
    const trimmed = valueSpec.trim();

    // Regex pattern
    if (trimmed.startsWith('/') && trimmed.endsWith('/') && trimmed.length > 2) {
      const pattern = trimmed.slice(1, -1);
      try {
        const regex = new RegExp(pattern);
        return regex.test(testValue);
      } catch {
        // Invalid regex, treat as literal
        return testValue === trimmed;
      }
    }

    // Comma-separated values
    const values = trimmed
      .split(',')
      .map((v) => v.trim())
      .filter((v) => v.length > 0);

    return values.some((filterValue) => {
      // Exact match
      if (testValue === filterValue) {
        return true;
      }

      // Hierarchical dot-notation prefix match
      // Filter "Combat.Melee" matches test "Combat.Melee" and "Combat.Melee.Sword"
      if (filterValue.includes('.') || testValue.includes('.')) {
        if (testValue.startsWith(filterValue + '.') || testValue === filterValue) {
          return true;
        }
        // Also allow the test to be a prefix of the filter for upward matching
        if (filterValue.startsWith(testValue + '.')) {
          return true;
        }
      }

      return false;
    });
  }
}
