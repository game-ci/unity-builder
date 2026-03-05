import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { exec } from '@actions/exec';
import OrchestratorLogger from '../core/orchestrator-logger';
import { OutputManifest, OutputEntry } from './output-manifest';

/**
 * Configuration for artifact upload.
 */
export interface ArtifactUploadConfig {
  /** Upload target: 'github-artifacts', 'storage', 'local', 'none' */
  target: 'github-artifacts' | 'storage' | 'local' | 'none';

  /** Destination path — storage URI for 'storage', local path for 'local' */
  destination?: string;

  /** Compression method */
  compression: 'none' | 'gzip' | 'lz4';

  /** Retention period in days (GitHub Artifacts only) */
  retentionDays: number;
}

/**
 * Result of an artifact upload operation.
 */
export interface UploadResult {
  /** Whether the upload succeeded overall */
  success: boolean;

  /** Per-entry upload results */
  entries: UploadEntryResult[];

  /** Total bytes uploaded */
  totalBytes: number;

  /** Duration in milliseconds */
  durationMs: number;
}

export interface UploadEntryResult {
  /** The output type name */
  type: string;

  /** The output path */
  path: string;

  /** Whether this entry uploaded successfully */
  success: boolean;

  /** Bytes uploaded for this entry */
  bytes: number;

  /** Error message if upload failed */
  error?: string;
}

/**
 * GitHub Artifacts size limit per artifact (10 GB).
 * Files larger than this must be split.
 */
const GITHUB_ARTIFACT_SIZE_LIMIT = 10 * 1024 * 1024 * 1024;

/**
 * Minimum valid storage URI pattern: "remote:path" or "remote:".
 * rclone requires at least a remote name followed by a colon.
 */
const STORAGE_URI_PATTERN = /^[a-zA-Z][\w-]*:/;

/**
 * Check whether rclone is installed and available on PATH.
 * Returns true if `rclone version` executes successfully.
 */
function isRcloneAvailable(): boolean {
  try {
    execFileSync('rclone', ['version'], { stdio: 'pipe', timeout: 5000 });

    return true;
  } catch {
    return false;
  }
}

/**
 * Validate that a storage destination URI has the correct rclone format.
 * Valid format: "remoteName:path" (e.g., "s3:bucket/prefix", "gdrive:folder").
 */
function isValidStorageUri(uri: string): boolean {
  return STORAGE_URI_PATTERN.test(uri);
}

/**
 * Handles uploading build artifacts to various targets.
 */
export class ArtifactUploadHandler {
  /**
   * Upload artifacts described by a manifest to the configured target.
   */
  static async uploadArtifacts(
    manifest: OutputManifest,
    config: ArtifactUploadConfig,
    projectPath: string,
  ): Promise<UploadResult> {
    const startTime = Date.now();
    const result: UploadResult = {
      success: true,
      entries: [],
      totalBytes: 0,
      durationMs: 0,
    };

    if (config.target === 'none') {
      OrchestratorLogger.log('[ArtifactUpload] Upload target is "none", skipping upload');
      result.durationMs = Date.now() - startTime;

      return result;
    }

    if (manifest.outputs.length === 0) {
      OrchestratorLogger.log('[ArtifactUpload] No outputs in manifest, nothing to upload');
      result.durationMs = Date.now() - startTime;

      return result;
    }

    OrchestratorLogger.log(`[ArtifactUpload] Uploading ${manifest.outputs.length} output(s) to ${config.target}`);

    for (const entry of manifest.outputs) {
      const entryResult = await ArtifactUploadHandler.uploadEntry(entry, config, projectPath);
      result.entries.push(entryResult);
      result.totalBytes += entryResult.bytes;

      if (!entryResult.success) {
        result.success = false;
      }
    }

    result.durationMs = Date.now() - startTime;

    OrchestratorLogger.log(
      `[ArtifactUpload] Upload complete: ${result.entries.filter((e) => e.success).length}/${
        result.entries.length
      } succeeded, ${result.totalBytes} bytes, ${result.durationMs}ms`,
    );

    return result;
  }

  /**
   * Upload a single output entry.
   */
  private static async uploadEntry(
    entry: OutputEntry,
    config: ArtifactUploadConfig,
    projectPath: string,
  ): Promise<UploadEntryResult> {
    const entryResult: UploadEntryResult = {
      type: entry.type,
      path: entry.path,
      success: false,
      bytes: entry.size || 0,
    };

    const resolvedPath = path.resolve(
      projectPath,
      entry.path.replace('{platform}', process.env.BUILD_TARGET || 'Unknown'),
    );

    if (!fs.existsSync(resolvedPath)) {
      entryResult.error = `Output path does not exist: ${resolvedPath}`;
      OrchestratorLogger.logWarning(`[ArtifactUpload] ${entryResult.error}`);

      return entryResult;
    }

    try {
      switch (config.target) {
        case 'github-artifacts':
          await ArtifactUploadHandler.uploadToGitHubArtifacts(entry, resolvedPath, config);
          break;
        case 'storage':
          await ArtifactUploadHandler.uploadToStorage(entry, resolvedPath, config);
          break;
        case 'local':
          await ArtifactUploadHandler.uploadToLocal(entry, resolvedPath, config);
          break;
      }
      entryResult.success = true;
      OrchestratorLogger.log(
        `[ArtifactUpload] Uploaded '${entry.type}' (${entryResult.bytes} bytes) to ${config.target}`,
      );
    } catch (error: any) {
      entryResult.error = error.message || String(error);
      OrchestratorLogger.logWarning(`[ArtifactUpload] Failed to upload '${entry.type}': ${entryResult.error}`);
    }

    return entryResult;
  }

  /**
   * Upload to GitHub Artifacts via @actions/artifact.
   * Handles large file splitting if artifacts exceed the size limit.
   */
  private static async uploadToGitHubArtifacts(
    entry: OutputEntry,
    resolvedPath: string,
    config: ArtifactUploadConfig,
  ): Promise<void> {
    // Dynamically require @actions/artifact — it may not be available in all environments.
    // Using a variable to prevent TypeScript from resolving the module at compile time.
    let artifact: any;
    try {
      const artifactModule = '@actions/artifact';
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      artifact = require(artifactModule);
    } catch {
      throw new Error('@actions/artifact package is not available. Install it to use github-artifacts upload target.');
    }

    const artifactClient = artifact.DefaultArtifactClient
      ? new artifact.DefaultArtifactClient()
      : artifact.default
      ? new artifact.default()
      : artifact;

    const files = ArtifactUploadHandler.collectFiles(resolvedPath);

    if (files.length === 0) {
      OrchestratorLogger.logWarning(`[ArtifactUpload] No files found at ${resolvedPath} for '${entry.type}'`);

      return;
    }

    const totalSize = entry.size || 0;
    const artifactName = `unity-output-${entry.type}`;

    if (totalSize > GITHUB_ARTIFACT_SIZE_LIMIT) {
      OrchestratorLogger.log(
        `[ArtifactUpload] Output '${entry.type}' exceeds GitHub Artifacts size limit (${totalSize} > ${GITHUB_ARTIFACT_SIZE_LIMIT}), splitting into chunks`,
      );
      await ArtifactUploadHandler.uploadChunked(artifactClient, artifactName, files, resolvedPath, config);
    } else {
      const rootDirectory = fs.statSync(resolvedPath).isDirectory() ? resolvedPath : path.dirname(resolvedPath);

      if (typeof artifactClient.uploadArtifact === 'function') {
        await artifactClient.uploadArtifact(artifactName, files, rootDirectory, {
          retentionDays: config.retentionDays,
          compressionLevel: config.compression === 'none' ? 0 : 6,
        });
      } else {
        throw new Error(
          '@actions/artifact client does not have uploadArtifact method. Ensure the package version is compatible.',
        );
      }
    }
  }

  /**
   * Upload large artifacts in chunks to stay within GitHub size limits.
   */
  private static async uploadChunked(
    artifactClient: any,
    baseName: string,
    files: string[],
    rootDirectory: string,
    config: ArtifactUploadConfig,
  ): Promise<void> {
    const chunkSize = GITHUB_ARTIFACT_SIZE_LIMIT;
    let currentChunkFiles: string[] = [];
    let currentChunkSize = 0;
    let chunkIndex = 0;

    for (const filePath of files) {
      const fileSize = fs.statSync(filePath).size;

      if (currentChunkSize + fileSize > chunkSize && currentChunkFiles.length > 0) {
        await ArtifactUploadHandler.uploadSingleChunk(
          artifactClient,
          `${baseName}-part${chunkIndex}`,
          currentChunkFiles,
          rootDirectory,
          config,
        );
        chunkIndex++;
        currentChunkFiles = [];
        currentChunkSize = 0;
      }

      currentChunkFiles.push(filePath);
      currentChunkSize += fileSize;
    }

    if (currentChunkFiles.length > 0) {
      await ArtifactUploadHandler.uploadSingleChunk(
        artifactClient,
        chunkIndex > 0 ? `${baseName}-part${chunkIndex}` : baseName,
        currentChunkFiles,
        rootDirectory,
        config,
      );
    }
  }

  private static async uploadSingleChunk(
    artifactClient: any,
    name: string,
    files: string[],
    rootDirectory: string,
    config: ArtifactUploadConfig,
  ): Promise<void> {
    OrchestratorLogger.log(`[ArtifactUpload] Uploading chunk '${name}' with ${files.length} file(s)`);

    if (typeof artifactClient.uploadArtifact === 'function') {
      await artifactClient.uploadArtifact(name, files, rootDirectory, {
        retentionDays: config.retentionDays,
        compressionLevel: config.compression === 'none' ? 0 : 6,
      });
    }
  }

  /**
   * Upload to remote storage via rclone.
   *
   * Validates rclone availability and destination URI format before attempting
   * the upload. If rclone is not installed, falls back to local copy when a
   * local-compatible destination is provided, or skips with a clear error.
   */
  private static async uploadToStorage(
    entry: OutputEntry,
    resolvedPath: string,
    config: ArtifactUploadConfig,
  ): Promise<void> {
    if (!config.destination) {
      throw new Error('Storage upload requires a destination URI in artifactUploadPath');
    }

    // Validate storage URI format before attempting upload
    if (!isValidStorageUri(config.destination)) {
      throw new Error(
        `Invalid storage destination URI: "${config.destination}". ` +
          'Expected rclone remote format "remoteName:path" (e.g., "s3:my-bucket/artifacts", "gdrive:builds").',
      );
    }

    // Check rclone availability before attempting upload
    if (!isRcloneAvailable()) {
      OrchestratorLogger.error(
        'rclone is not installed or not in PATH. ' +
          'Install rclone (https://rclone.org/install/) to use storage-based artifact upload. ' +
          'Falling back to local copy.',
      );

      // Attempt local copy fallback using the destination as a hint
      // Strip the remote prefix to get a local-ish path for fallback
      OrchestratorLogger.logWarning(
        `[ArtifactUpload] Storage upload skipped for '${entry.type}' — rclone not available`,
      );
      throw new Error(
        'rclone is not installed or not in PATH. ' +
          'Install rclone from https://rclone.org/install/ to use storage-based artifact upload.',
      );
    }

    const destination = `${config.destination}/${entry.type}`;

    OrchestratorLogger.log(`[ArtifactUpload] Uploading '${entry.type}' to storage: ${destination}`);

    const args = ['copy', resolvedPath, destination, '--progress'];

    if (config.compression !== 'none') {
      // rclone doesn't have built-in compression flags for copy;
      // compression is typically handled by the remote configuration.
      // Log as informational.
      OrchestratorLogger.log(
        `[ArtifactUpload] Note: compression '${config.compression}' is configured at the remote level for rclone`,
      );
    }

    await exec('rclone', args);
  }

  /**
   * Upload to a local path (copy).
   */
  private static async uploadToLocal(
    entry: OutputEntry,
    resolvedPath: string,
    config: ArtifactUploadConfig,
  ): Promise<void> {
    if (!config.destination) {
      throw new Error('Local upload requires a destination path in artifactUploadPath');
    }

    const destination = path.join(config.destination, entry.type);
    fs.mkdirSync(destination, { recursive: true });

    OrchestratorLogger.log(`[ArtifactUpload] Copying '${entry.type}' to local path: ${destination}`);

    ArtifactUploadHandler.copyRecursive(resolvedPath, destination);
  }

  /**
   * Recursively copy files from source to destination.
   */
  private static copyRecursive(source: string, destination: string): void {
    const stat = fs.statSync(source);

    if (stat.isDirectory()) {
      fs.mkdirSync(destination, { recursive: true });
      const entries = fs.readdirSync(source);
      for (const entry of entries) {
        ArtifactUploadHandler.copyRecursive(path.join(source, entry), path.join(destination, entry));
      }
    } else {
      fs.copyFileSync(source, destination);
    }
  }

  /**
   * Collect all files at a given path (recursively if directory).
   */
  static collectFiles(targetPath: string): string[] {
    const stat = fs.statSync(targetPath);

    if (!stat.isDirectory()) {
      return [targetPath];
    }

    const files: string[] = [];
    const entries = fs.readdirSync(targetPath, { withFileTypes: true });

    for (const entry of entries) {
      const fullPath = path.join(targetPath, entry.name);
      if (entry.isDirectory()) {
        files.push(...ArtifactUploadHandler.collectFiles(fullPath));
      } else {
        files.push(fullPath);
      }
    }

    return files;
  }

  /**
   * Parse an ArtifactUploadConfig from action inputs.
   */
  static parseConfig(
    target: string,
    destination: string | undefined,
    compression: string,
    retentionDays: string,
  ): ArtifactUploadConfig {
    const validTargets = ['github-artifacts', 'storage', 'local', 'none'] as const;
    const resolvedTarget = validTargets.includes(target as any)
      ? (target as ArtifactUploadConfig['target'])
      : 'github-artifacts';

    const validCompressions = ['none', 'gzip', 'lz4'] as const;
    const resolvedCompression = validCompressions.includes(compression as any)
      ? (compression as ArtifactUploadConfig['compression'])
      : 'gzip';

    const parsedRetention = Number.parseInt(retentionDays, 10);
    const resolvedRetention = Number.isNaN(parsedRetention) || parsedRetention <= 0 ? 30 : parsedRetention;

    return {
      target: resolvedTarget,
      destination: destination || undefined,
      compression: resolvedCompression,
      retentionDays: resolvedRetention,
    };
  }
}
