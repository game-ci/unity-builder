import { exec } from '../dependencies.ts';

export interface ShellRunOptions {
  pwd: string;
}

class System {
  /**
   * Run any command as if you're typing in shell.
   * Make sure it's Windows/MacOS/Ubuntu compatible or has alternative commands.
   *
   * Intended to always be silent and capture the output.
   */
  static async shellRun(rawCommand: string, options: ShellRunOptions = {}) {
    const { pwd } = options;

    let command = rawCommand;
    if (pwd) command = `cd ${pwd} ; ${command}`;

    return System.newRun('sh', ['-c', command]);
  }

  /**
   * Example:
   *   System.newRun(sh, ['-c', 'echo something'])
   *
   * private for now, but could become public if this happens to be a great replacement for the other run method.
   */
  private static async newRun(command, args: string | string[] = []) {
    if (!Array.isArray(args)) args = [args];

    const argsString = args.join(' ');
    const process = Deno.run({
      cmd: [command, ...args],
      stdout: 'piped',
      stderr: 'piped',
    });

    const status = await process.status();
    const outputBuffer = await process.output();
    const errorBuffer = await process.stderrOutput();

    process.close();

    const output = new TextDecoder().decode(outputBuffer);
    const error = new TextDecoder().decode(errorBuffer);

    const result = { status, output };
    const symbol = status.success ? '✅' : '❗';

    const truncatedOutput = output.length >= 30 ? `${output.slice(0, 27)}...` : output;
    log.debug('Command:', command, argsString, symbol, { status, output: truncatedOutput });

    if (error) throw new Error(error);

    return result;
  }

  /**
   * @deprecated use more simplified `shellRun` if possible.
   */
  static async run(command, arguments_: any = [], options = {}, shouldLog = true) {
    let result = '';
    let error = '';
    let debug = '';

    const listeners = {
      stdout: (dataBuffer) => {
        result += dataBuffer.toString();
      },
      stderr: (dataBuffer) => {
        error += dataBuffer.toString();
      },
      debug: (dataString) => {
        debug += dataString.toString();
      },
    };

    const showOutput = () => {
      if (debug !== '' && shouldLog) {
        log.debug(debug);
      }

      if (result !== '' && shouldLog) {
        log.info(result);
      }

      if (error !== '' && shouldLog) {
        log.warning(error);
      }
    };

    const throwContextualError = (message: string) => {
      let commandAsString = command;
      if (Array.isArray(arguments_)) {
        commandAsString += ` ${arguments_.join(' ')}`;
      } else if (typeof arguments_ === 'string') {
        commandAsString += ` ${arguments_}`;
      }

      throw new Error(`Failed to run "${commandAsString}".\n ${message}`);
    };

    try {
      if (command.trim() === '') {
        throw new Error(`Failed to execute empty command`);
      }

      const { exitCode, success, output } = await exec(command, arguments_, { silent: true, listeners, ...options });
      showOutput();
      if (!success) {
        throwContextualError(`Command returned non-zero exit code (${exitCode}).\nError: ${error}`);
      }

      // Todo - remove this after verifying it works as expected
      const trimmedResult = result.replace(/\n+$/, '');
      if (!output && trimmedResult) {
        log.warning('returning result instead of output for backward compatibility');

        return trimmedResult;
      }

      return output;
    } catch (inCommandError) {
      showOutput();
      throwContextualError(`In-command error caught: ${inCommandError}`);
    }
  }
}

export default System;
