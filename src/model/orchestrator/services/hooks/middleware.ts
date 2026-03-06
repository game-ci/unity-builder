import OrchestratorSecret from '../../options/orchestrator-secret';

/**
 * Trigger conditions that determine when a middleware activates.
 * All specified conditions must be true (AND logic).
 */
export interface MiddlewareTrigger {
  /** Pipeline phases this middleware applies to: 'setup', 'build', 'pre-build', 'post-build' */
  phase: string[];
  /** Restrict to specific providers. If omitted, applies to all providers. */
  provider?: string[];
  /** Restrict to specific build target platforms. If omitted, applies to all platforms. */
  platform?: string[];
  /** Expression-based condition. Supports: env.VAR == 'value', env.VAR != 'value', env.VAR (truthy) */
  when?: string;
}

/**
 * A single phase (before or after) of a middleware definition.
 */
export interface MiddlewarePhase {
  /** Shell commands to execute */
  commands: string;
  /** Override image for this phase (container type only) */
  image?: string;
}

/**
 * Middleware — a composable, trigger-aware pipeline unit built on hooks.
 *
 * Middleware wraps around pipeline phases with before/after semantics.
 * Each middleware resolves to either CommandHooks (inline in build container)
 * or ContainerHooks (separate Docker containers) at execution time.
 *
 * Execution order: before phases run in ascending priority order,
 * after phases run in descending priority order (wrapping pattern).
 *
 * Example YAML:
 * ```yaml
 * name: code-signing
 * description: Signs build artifacts after successful build
 * type: container
 * priority: 50
 * image: ubuntu:22.04
 * trigger:
 *   phase: [build]
 *   provider: [aws, k8s]
 *   platform: [StandaloneWindows64]
 *   when: "env.SIGN_BUILDS == 'true'"
 * before:
 *   commands: |
 *     echo "Preparing signing environment..."
 * after:
 *   commands: |
 *     echo "Signing build artifacts..."
 * secrets:
 *   - name: SIGNING_KEY
 *   - name: SIGNING_CERT
 * allowFailure: false
 * ```
 */
export class Middleware {
  /** Unique name identifying this middleware */
  public name!: string;
  /** Human-readable description */
  public description?: string;
  /** Hook type: 'command' (inline in build container) or 'container' (separate Docker container) */
  public type!: 'command' | 'container';
  /** Execution priority. Lower values run first for before, last for after (wrapping order). Default: 100 */
  public priority: number = 100;
  /** Conditions that determine when this middleware activates */
  public trigger!: MiddlewareTrigger;
  /** Default Docker image for container type middleware */
  public image: string = 'ubuntu';
  /** Commands to run before the target phase */
  public before?: MiddlewarePhase;
  /** Commands to run after the target phase */
  public after?: MiddlewarePhase;
  /** Secrets injected as environment variables */
  public secrets: OrchestratorSecret[] = [];
  /** If true, failures warn but don't stop the build. Default: false */
  public allowFailure: boolean = false;
  /** Environment variable names this middleware exports to downstream middleware */
  public outputs?: string[];
}
