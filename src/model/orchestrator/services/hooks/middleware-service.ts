import YAML from 'yaml';
import fs from 'node:fs';
import path from 'node:path';
import { Middleware, MiddlewareTrigger } from './middleware';
import { ContainerHook } from './container-hook';
import { CommandHook } from './command-hook';
import OrchestratorOptions from '../../options/orchestrator-options';
import Orchestrator from '../../orchestrator';
import OrchestratorLogger from '../core/orchestrator-logger';
import Input from '../../../input';

/**
 * Service for loading, evaluating, and resolving middleware into hooks.
 *
 * Middleware is a higher-level composable abstraction over the existing
 * command hook and container hook systems. Each middleware:
 * - Wraps around pipeline phases with before/after semantics
 * - Has trigger conditions (phase, provider, platform, expression)
 * - Resolves to either CommandHooks or ContainerHooks at execution time
 * - Executes in priority order (before: ascending, after: descending)
 */
export class MiddlewareService {
  /**
   * Load all active middleware from inline YAML + file-based definitions.
   * Returns them sorted by priority (ascending).
   */
  static getMiddleware(inlineYaml: string): Middleware[] {
    const middleware: Middleware[] = [];

    // Parse inline YAML definitions
    if (inlineYaml && inlineYaml !== '') {
      middleware.push(...MiddlewareService.parseMiddleware(inlineYaml));
    }

    // Load file-based definitions from game-ci/middleware/
    middleware.push(...MiddlewareService.getMiddlewareFromFiles());

    // Sort by priority (lower = earlier)
    middleware.sort((a, b) => (a.priority ?? 100) - (b.priority ?? 100));

    OrchestratorLogger.log(`Middleware: loaded ${middleware.length} definition(s)`);

    return middleware;
  }

  /**
   * Resolve middleware to CommandHooks for a given phase and timing.
   * Filters by trigger conditions and converts to hooks.
   *
   * Before hooks: ascending priority (lowest priority runs first, closest to core phase).
   * After hooks: descending priority (highest priority runs first, closest to core phase).
   * This produces the wrapping pattern: outermost middleware's before runs first and after runs last.
   */
  static resolveCommandHooks(middleware: Middleware[], phase: string, timing: 'before' | 'after'): CommandHook[] {
    const applicable = middleware
      .filter((m) => m.type === 'command')
      .filter((m) => MiddlewareService.evaluateTrigger(m.trigger, phase));

    // before: ascending priority; after: descending (wrapping order)
    if (timing === 'after') {
      applicable.reverse();
    }

    const hooks = applicable
      .filter((m) => (timing === 'before' ? m.before : m.after))
      .map((m) => {
        const mPhase = timing === 'before' ? m.before! : m.after!;
        const hook = new CommandHook();
        hook.name = `middleware:${m.name}:${timing}`;
        hook.commands = typeof mPhase.commands === 'string' ? [mPhase.commands] : [mPhase.commands];
        hook.hook = [timing];
        hook.step = [phase];
        hook.secrets = m.secrets || [];

        return hook;
      });

    if (hooks.length > 0) {
      OrchestratorLogger.log(
        `Middleware: resolved ${hooks.length} command hook(s) for ${phase}:${timing} — ${hooks
          .map((h) => h.name)
          .join(', ')}`,
      );
    }

    return hooks;
  }

  /**
   * Resolve middleware to ContainerHooks for a given phase and timing.
   * Same ordering logic as resolveCommandHooks.
   */
  static resolveContainerHooks(middleware: Middleware[], phase: string, timing: 'before' | 'after'): ContainerHook[] {
    const applicable = middleware
      .filter((m) => m.type === 'container')
      .filter((m) => MiddlewareService.evaluateTrigger(m.trigger, phase));

    // before: ascending priority; after: descending (wrapping order)
    if (timing === 'after') {
      applicable.reverse();
    }

    const hooks = applicable
      .filter((m) => (timing === 'before' ? m.before : m.after))
      .map((m) => {
        const mPhase = timing === 'before' ? m.before! : m.after!;
        const hook = new ContainerHook();
        hook.name = `middleware:${m.name}:${timing}`;
        hook.commands = typeof mPhase.commands === 'string' ? mPhase.commands : mPhase.commands;
        hook.image = mPhase.image || m.image || 'ubuntu';
        hook.hook = timing === 'before' ? 'before' : 'after';
        hook.secrets = m.secrets || [];
        hook.allowFailure = m.allowFailure ?? false;

        return hook;
      });

    if (hooks.length > 0) {
      OrchestratorLogger.log(
        `Middleware: resolved ${hooks.length} container hook(s) for ${phase}:${timing} — ${hooks
          .map((h) => h.name)
          .join(', ')}`,
      );
    }

    return hooks;
  }

  /**
   * Evaluate whether a middleware's trigger conditions are met.
   * All specified conditions must pass (AND logic).
   */
  static evaluateTrigger(trigger: MiddlewareTrigger, currentPhase: string): boolean {
    // Phase must match
    if (!trigger.phase || !trigger.phase.includes(currentPhase)) {
      return false;
    }

    // Provider filter (if specified)
    if (trigger.provider && trigger.provider.length > 0) {
      const currentProvider = Orchestrator.buildParameters?.providerStrategy || OrchestratorOptions.providerStrategy;
      if (!trigger.provider.includes(currentProvider)) {
        return false;
      }
    }

    // Platform filter (if specified)
    if (trigger.platform && trigger.platform.length > 0) {
      const currentPlatform = Orchestrator.buildParameters?.targetPlatform || '';
      if (!trigger.platform.includes(currentPlatform)) {
        return false;
      }
    }

    // Expression-based condition
    if (trigger.when) {
      if (!MiddlewareService.evaluateExpression(trigger.when)) {
        return false;
      }
    }

    return true;
  }

  /**
   * Evaluate a simple expression string against environment variables.
   *
   * Supported formats:
   * - env.VAR_NAME == 'value'   — equality check
   * - env.VAR_NAME != 'value'   — inequality check
   * - env.VAR_NAME              — truthy check (defined, non-empty, not 'false')
   * - !env.VAR_NAME             — falsy check
   */
  static evaluateExpression(expression: string): boolean {
    const trimmed = expression.trim();

    // Match: env.VAR == 'value' or env.VAR != 'value'
    const comparisonMatch = trimmed.match(/^env\.(\w+)\s*(==|!=)\s*['"](.*)['"]$/);
    if (comparisonMatch) {
      const [, varName, operator, value] = comparisonMatch;
      const envValue = process.env[varName] || '';

      return operator === '==' ? envValue === value : envValue !== value;
    }

    // Match: !env.VAR (falsy check)
    const falsyMatch = trimmed.match(/^!env\.(\w+)$/);
    if (falsyMatch) {
      const [, varName] = falsyMatch;
      const envValue = process.env[varName];

      return envValue === undefined || envValue === '' || envValue === 'false';
    }

    // Match: env.VAR (truthy check)
    const truthyMatch = trimmed.match(/^env\.(\w+)$/);
    if (truthyMatch) {
      const [, varName] = truthyMatch;
      const envValue = process.env[varName];

      return envValue !== undefined && envValue !== '' && envValue !== 'false';
    }

    // Unknown expression format — log warning, default to true
    OrchestratorLogger.logWarning(`Middleware: unknown expression format "${expression}", defaulting to true`);

    return true;
  }

  /**
   * Parse middleware definitions from a YAML string.
   * Accepts both single-object and array format.
   */
  static parseMiddleware(yamlString: string): Middleware[] {
    if (!yamlString || yamlString.trim() === '') {
      return [];
    }

    try {
      const isArray = yamlString.replace(/\s/g, '')[0] === '-';
      const parsed = isArray ? YAML.parse(yamlString) : [YAML.parse(yamlString)];

      if (!parsed || !Array.isArray(parsed)) {
        return [];
      }

      return parsed.map((m: any) => MiddlewareService.hydrateMiddleware(m));
    } catch (error: any) {
      OrchestratorLogger.logWarning(`Middleware: failed to parse YAML — ${error.message}`);

      return [];
    }
  }

  /**
   * Hydrate a raw parsed YAML object into a Middleware instance.
   */
  private static hydrateMiddleware(m: any): Middleware {
    const middleware = new Middleware();
    middleware.name = m.name || 'unnamed';
    middleware.description = m.description;
    middleware.type = m.type || 'command';
    middleware.priority = m.priority ?? 100;
    middleware.image = m.image || 'ubuntu';
    middleware.allowFailure = m.allowFailure ?? false;
    middleware.outputs = m.outputs;

    // Parse trigger — normalize scalar values to arrays
    middleware.trigger = {
      phase: MiddlewareService.toStringArray(m.trigger?.phase),
      provider: m.trigger?.provider ? MiddlewareService.toStringArray(m.trigger.provider) : undefined,
      platform: m.trigger?.platform ? MiddlewareService.toStringArray(m.trigger.platform) : undefined,
      when: m.trigger?.when,
    };

    // Parse before/after phases — accept string shorthand or object format
    if (m.before) {
      middleware.before = {
        commands: typeof m.before === 'string' ? m.before : m.before.commands || '',
        image: typeof m.before === 'string' ? undefined : m.before.image,
      };
    }
    if (m.after) {
      middleware.after = {
        commands: typeof m.after === 'string' ? m.after : m.after.commands || '',
        image: typeof m.after === 'string' ? undefined : m.after.image,
      };
    }

    // Parse secrets
    if (m.secrets && Array.isArray(m.secrets)) {
      middleware.secrets = m.secrets.map((s: any) => ({
        ParameterKey: s.name,
        EnvironmentVariable: Input.ToEnvVarFormat(s.name),
        ParameterValue: s.value ?? process.env[s.name] ?? process.env[Input.ToEnvVarFormat(s.name)] ?? '',
      }));
    }

    return middleware;
  }

  /**
   * Load middleware definitions from game-ci/middleware/ directory files.
   * Only files whose base name appears in the middlewareFiles allowlist are loaded.
   */
  static getMiddlewareFromFiles(): Middleware[] {
    const results: Middleware[] = [];
    const allowedFiles = OrchestratorOptions.middlewareFiles;
    if (!allowedFiles || allowedFiles.length === 0) {
      return results;
    }

    try {
      const middlewarePath = path.join(process.cwd(), 'game-ci', 'middleware');
      if (!fs.existsSync(middlewarePath)) {
        return results;
      }

      const files = fs.readdirSync(middlewarePath);
      for (const file of files) {
        const baseName = file.replace(/\.ya?ml$/, '');
        if (!allowedFiles.includes(baseName)) {
          continue;
        }

        try {
          const contents = fs.readFileSync(path.join(middlewarePath, file), 'utf8');
          results.push(...MiddlewareService.parseMiddleware(contents));
        } catch (error: any) {
          OrchestratorLogger.logWarning(`Middleware: failed to parse file ${file} — ${error.message}`);
        }
      }
    } catch {
      // Directory doesn't exist or can't be read — not an error
    }

    return results;
  }

  /**
   * Normalize a value to a string array. Accepts string, string[], or undefined.
   */
  private static toStringArray(value: any): string[] {
    if (!value) return [];
    if (Array.isArray(value)) return value;

    return [value];
  }
}
