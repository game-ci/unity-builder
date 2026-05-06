export class Cli {
  public static options: Record<string, any> | undefined;
  static get isCliMode() {
    return Cli.options !== undefined && Cli.options.mode !== undefined && Cli.options.mode !== '';
  }
  public static query(key: string, alternativeKey: string) {
    if (Cli.options && Cli.options[key] !== undefined) {
      return Cli.options[key];
    }
    if (Cli.options && alternativeKey && Cli.options[alternativeKey] !== undefined) {
      return Cli.options[alternativeKey];
    }

    return;
  }
}
