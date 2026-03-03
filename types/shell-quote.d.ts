declare module 'shell-quote' {
  /**
   * Quote an array of strings to be safe to use as shell arguments.
   * @param args - Array of strings to quote
   * @returns A properly escaped string for shell usage
   */
  export function quote(args: string[]): string;

  /**
   * Parse a shell command string into an array of arguments.
   * @param cmd - The command string to parse
   * @returns Array of parsed arguments
   */
  export function parse(cmd: string): string[];
}

