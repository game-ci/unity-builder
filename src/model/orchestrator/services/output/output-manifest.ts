/**
 * Structured build output manifest.
 * Describes all artifacts produced by a build with type, path, size, hash, and metadata.
 */

export interface OutputEntry {
  /** Output type identifier (e.g., 'build', 'test-results', 'images') */
  type: string;

  /** Relative path to the output */
  path: string;

  /** Output format (e.g., 'nunit3', 'junit', 'json') */
  format?: string;

  /** File size in bytes */
  size?: number;

  /** Content hash (e.g., 'sha256:abc...') */
  hash?: string;

  /** Individual files within the output path */
  files?: string[];

  /** Type-specific summary (e.g., test counts, build size) */
  summary?: Record<string, unknown>;

  /** Arbitrary metadata */
  metadata?: Record<string, unknown>;
}

export interface OutputManifest {
  /** Unique build identifier */
  buildGuid: string;

  /** ISO 8601 timestamp */
  timestamp: string;

  /** All outputs produced by this build */
  outputs: OutputEntry[];
}
