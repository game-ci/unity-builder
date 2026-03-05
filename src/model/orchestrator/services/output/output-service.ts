import fs from 'node:fs';
import path from 'node:path';
import OrchestratorLogger from '../core/orchestrator-logger';
import { OutputManifest, OutputEntry } from './output-manifest';
import { OutputTypeRegistry } from './output-type-registry';

/**
 * Service for collecting, manifesting, and managing build outputs.
 *
 * After a build completes, this service scans declared output paths,
 * generates a structured manifest, and prepares outputs for post-processing.
 */
export class OutputService {
  /**
   * Collect outputs from the workspace and generate a manifest.
   *
   * @param projectPath - Path to the Unity project root
   * @param buildGuid - Unique build identifier
   * @param outputTypesInput - Comma-separated output type names
   * @param manifestPath - Where to write the manifest JSON (optional)
   * @returns The generated output manifest
   */
  static async collectOutputs(
    projectPath: string,
    buildGuid: string,
    outputTypesInput: string,
    manifestPath?: string,
  ): Promise<OutputManifest> {
    const types = OutputTypeRegistry.parseOutputTypes(outputTypesInput);
    const manifest: OutputManifest = {
      buildGuid,
      timestamp: new Date().toISOString(),
      outputs: [],
    };

    if (types.length === 0) {
      OrchestratorLogger.log('[Output] No output types declared, skipping collection');

      return manifest;
    }

    OrchestratorLogger.log(`[Output] Collecting ${types.length} output type(s): ${types.map((t) => t.name).join(', ')}`);

    for (const typeDef of types) {
      const outputPath = path.join(projectPath, typeDef.defaultPath.replace('{platform}', process.env.BUILD_TARGET || 'Unknown'));

      if (!fs.existsSync(outputPath)) {
        OrchestratorLogger.log(`[Output] No output found for '${typeDef.name}' at ${outputPath}`);
        continue;
      }

      const entry: OutputEntry = {
        type: typeDef.name,
        path: typeDef.defaultPath,
      };

      // Collect file listing for directory outputs
      try {
        const stat = fs.statSync(outputPath);
        if (stat.isDirectory()) {
          entry.files = fs.readdirSync(outputPath);
          entry.size = OutputService.getDirectorySize(outputPath);
        } else {
          entry.size = stat.size;
        }
      } catch {
        OrchestratorLogger.logWarning(`[Output] Failed to stat output '${typeDef.name}' at ${outputPath}`);
      }

      manifest.outputs.push(entry);
      OrchestratorLogger.log(`[Output] Collected '${typeDef.name}': ${entry.files?.length || 1} file(s), ${entry.size || 0} bytes`);
    }

    // Write manifest to disk
    if (manifestPath) {
      try {
        const manifestDir = path.dirname(manifestPath);
        fs.mkdirSync(manifestDir, { recursive: true });
        fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2), 'utf8');
        OrchestratorLogger.log(`[Output] Manifest written to ${manifestPath}`);
      } catch (error: any) {
        OrchestratorLogger.logWarning(`[Output] Failed to write manifest: ${error.message}`);
      }
    }

    return manifest;
  }

  /**
   * Calculate total size of a directory recursively.
   */
  private static getDirectorySize(dirPath: string): number {
    let totalSize = 0;

    try {
      const entries = fs.readdirSync(dirPath, { withFileTypes: true });
      for (const entry of entries) {
        const fullPath = path.join(dirPath, entry.name);
        if (entry.isDirectory()) {
          totalSize += OutputService.getDirectorySize(fullPath);
        } else {
          totalSize += fs.statSync(fullPath).size;
        }
      }
    } catch {
      // Ignore errors in size calculation
    }

    return totalSize;
  }
}
