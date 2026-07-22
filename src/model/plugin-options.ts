/**
 * Shared options bridge between unity-builder and plugins (e.g. @game-ci/orchestrator).
 *
 * Plugins set PluginOptions.options to pass configuration into BuildParameters
 * and Input. When options are set, isPluginMode is true and query() reads
 * from the options map instead of @actions/core.getInput().
 */
export class PluginOptions {
  public static options: Record<string, any> | undefined;

  static get isPluginMode() {
    return Boolean(PluginOptions.options?.mode);
  }

  public static query(key: string, alternativeKey: string) {
    if (PluginOptions.options && PluginOptions.options[key] !== undefined) {
      return PluginOptions.options[key];
    }
    if (
      PluginOptions.options &&
      alternativeKey &&
      PluginOptions.options[alternativeKey] !== undefined
    ) {
      return PluginOptions.options[alternativeKey];
    }

    return;
  }
}

// Backwards-compatible alias — the orchestrator still imports { Cli }
export { PluginOptions as Cli };
