import { exec as originalExec } from 'https://deno.land/x/exec/mod.ts';
import { core } from './core.ts';

export enum OutputMode {
  None = 0, // no output, just run the command
  StdOut, // dump the output to stdout
  Capture, // capture the output and return it
  Tee, // both dump and capture the output
}

export interface IExecResponse {
  code: number;
  success: boolean;
  output: string;
}

interface IOptions {
  output?: OutputMode;
  verbose?: boolean;
  continueOnError?: boolean;
}

// Todo - change signature of exec inside the code instead of adapting the exec method
const exec = async (command, args: string | string[] = [], ghActionsOptions: IOptions = {}): Promise<IExecResponse> => {
  core.info('Running command: ', command, args);

  const options = {
    output: OutputMode.Tee,
    verbose: false,
    continueOnError: false,
  };

  const { silent = false, ignoreReturnCode } = ghActionsOptions;
  if (silent) options.output = OutputMode.None;
  if (ignoreReturnCode) options.continueOnError = true;

  const result = await originalExec(`${command} ${args.join(' ')}`, options);
  core.info('result:', result);

  const { status = {}, output = '' } = result;
  const { code: exitCode, success } = status;

  return { exitCode, success, output };
};

export { exec };
