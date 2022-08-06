import { exec as originalExec } from 'https://deno.land/x/exec@0.0.5/mod.ts';
import { core } from './core.ts';

export enum OutputMode {
  None = 0, // no output, just run the command
  StdOut, // dump the output to stdout
  Capture, // capture the output and return it
  Tee, // both dump and capture the output
}

export interface ICommandResult {
  status?: {
    code: number;
    success: boolean;
  };
  output: string;
}

export interface ISanitisedCommandResult {
  exitCode: number;
  success: boolean;
  output: string;
}

interface IOptions {
  silent?: boolean;
  ignoreReturnCode?: boolean;
  output?: OutputMode;
  verbose?: boolean;
  continueOnError?: boolean;
}

const exec = async (
  command: string,
  args: string | string[] = [],
  ghActionsOptions: IOptions = {},
): Promise<ISanitisedCommandResult> => {
  const options = {
    output: OutputMode.Tee,
    verbose: false,
    continueOnError: false,
  };

  const { silent = false, ignoreReturnCode } = ghActionsOptions;
  if (silent) options.output = OutputMode.Capture;
  if (ignoreReturnCode) options.continueOnError = true;

  const argsString = typeof args === 'string' ? args : args.join(' ');
  const result: ICommandResult = await originalExec(`${command} ${argsString}`, options);

  const { status, output = '' } = result;
  const { code: exitCode, success } = status;

  const symbol = success ? '✅' : '❗';
  log.debug('Command:', command, argsString, symbol, result);

  return { exitCode, success, output: output.trim() };
};

export { exec };
