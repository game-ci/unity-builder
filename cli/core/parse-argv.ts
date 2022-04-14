import { CliOptions } from './cli-options.ts';

/**
 * Parse command line arguments
 *
 * Usage:
 *   console.dir(parseArgv(Deno.args)); // Deno
 *   console.log(parseArgv(process.argv)); // Node
 *
 * Example:
 *   deno run my-script -test1=1 -test2 "2" -test3 -test4 false -test5 "one" -test6= -test7=9BX9
 *
 * Output:
 *   Map {
 *     "test1" => 1,
 *     "test2" => 2,
 *     "test3" => true,
 *     "test4" => false,
 *     "test5" => "one",
 *     "test6" => "",
 *     "test7" => "9BX9"
 *   }
 */
export const parseArgv = (argv: string[] = [], { verbose = false } = {}): CliOptions => {
  const providedArguments = new Map<string, string | number | boolean>();

  for (let current = 0, next = 1; current < argv.length; current += 1, next += 1) {
    // Detect flag
    if (!argv[current].startsWith('-')) continue;
    let flag = argv[current].replace(/^-+/, '');

    // Detect value
    const hasNextArgument = next < argv.length && !argv[next].startsWith('-');
    let value: string | number | boolean = hasNextArgument ? argv[next] : 'true';

    // Split combinations
    const isCombination = flag.includes('=');
    if (isCombination) [flag, value] = flag.split('=');

    // Parse types
    if (['true', 'false'].includes(value)) value = value === 'true';
    else if (!Number.isNaN(Number(value)) && !Number.isNaN(Number.parseInt(value))) value = Number.parseInt(value);

    // Assign
    // eslint-disable-next-line no-console
    if (verbose) console.log(`Found flag "${flag}" with value "${value}" (${typeof value}).`);
    providedArguments.set(flag, value);
  }

  return providedArguments;
};
