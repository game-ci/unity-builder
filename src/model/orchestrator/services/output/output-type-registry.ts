import OrchestratorLogger from '../core/orchestrator-logger';

/**
 * Registry of known output types with default paths and processing hints.
 */

export interface OutputTypeDefinition {
  /** Type identifier */
  name: string;

  /** Default output path (relative to project root) */
  defaultPath: string;

  /** Human-readable description */
  description: string;

  /** Whether this type is built-in or user-registered */
  builtIn: boolean;
}

export class OutputTypeRegistry {
  private static readonly builtInTypes: Record<string, OutputTypeDefinition> = {
    build: {
      name: 'build',
      defaultPath: './Builds/{platform}/',
      description: 'Standard game build artifact',
      builtIn: true,
    },
    'test-results': {
      name: 'test-results',
      defaultPath: './TestResults/',
      description: 'NUnit/JUnit XML test results',
      builtIn: true,
    },
    'server-build': {
      name: 'server-build',
      defaultPath: './Builds/{platform}-server/',
      description: 'Dedicated server build artifact',
      builtIn: true,
    },
    'data-export': {
      name: 'data-export',
      defaultPath: './Exports/',
      description: 'Exported data files (CSV, JSON, binary)',
      builtIn: true,
    },
    images: {
      name: 'images',
      defaultPath: './Captures/',
      description: 'Screenshots, render captures, atlas previews',
      builtIn: true,
    },
    logs: {
      name: 'logs',
      defaultPath: './Logs/',
      description: 'Structured build and test logs',
      builtIn: true,
    },
    metrics: {
      name: 'metrics',
      defaultPath: './Metrics/',
      description: 'Build performance metrics and asset statistics',
      builtIn: true,
    },
    coverage: {
      name: 'coverage',
      defaultPath: './Coverage/',
      description: 'Code coverage reports',
      builtIn: true,
    },
  };

  private static customTypes: Record<string, OutputTypeDefinition> = {};

  /**
   * Get a type definition by name. Checks custom types first, then built-in.
   */
  static getType(name: string): OutputTypeDefinition | undefined {
    return OutputTypeRegistry.customTypes[name] || OutputTypeRegistry.builtInTypes[name];
  }

  /**
   * Get all registered types (built-in + custom).
   */
  static getAllTypes(): OutputTypeDefinition[] {
    return [
      ...Object.values(OutputTypeRegistry.builtInTypes),
      ...Object.values(OutputTypeRegistry.customTypes),
    ];
  }

  /**
   * Register a custom output type.
   */
  static registerType(definition: OutputTypeDefinition): void {
    if (OutputTypeRegistry.builtInTypes[definition.name]) {
      OrchestratorLogger.logWarning(
        `[OutputTypes] Cannot override built-in type '${definition.name}'`,
      );

      return;
    }

    OutputTypeRegistry.customTypes[definition.name] = { ...definition, builtIn: false };
    OrchestratorLogger.log(`[OutputTypes] Registered custom type '${definition.name}'`);
  }

  /**
   * Parse a comma-separated output types string into type definitions.
   * Unknown types are logged as warnings and skipped.
   */
  static parseOutputTypes(outputTypesInput: string): OutputTypeDefinition[] {
    if (!outputTypesInput) {
      return [];
    }

    const names = outputTypesInput.split(',').map((s) => s.trim()).filter(Boolean);
    const types: OutputTypeDefinition[] = [];

    for (const name of names) {
      const typeDef = OutputTypeRegistry.getType(name);
      if (typeDef) {
        types.push(typeDef);
      } else {
        OrchestratorLogger.logWarning(`[OutputTypes] Unknown output type '${name}', skipping`);
      }
    }

    return types;
  }

  /**
   * Reset custom types (for testing).
   */
  static resetCustomTypes(): void {
    OutputTypeRegistry.customTypes = {};
  }
}
