import * as core from '@actions/core';
import { exec, ExecListeners } from '@actions/exec';

class System {
  static async run(command: string, arguments_: string[] = [], options = {}, shouldLog = true) {
    let result = '';
    let error = '';
    let debug = '';

    const listeners: ExecListeners = {
      stdout: (dataBuffer: Buffer) => {
        result += dataBuffer.toString();
      },
      stderr: (dataBuffer: Buffer) => {
        error += dataBuffer.toString();
      },
      debug: (dataString: string) => {
        debug += dataString;
      },
    };

    const showOutput = () => {
      if (debug !== '' && shouldLog) {
        core.debug(debug);
      }

      if (result !== '' && shouldLog) {
        core.info(result);
      }

      if (error !== '' && shouldLog) {
        core.warning(error);
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

      const exitCode = await exec(command, arguments_, { silent: true, listeners, ...options });
      showOutput();
      if (exitCode !== 0) {
        throwContextualError(`Command returned non-zero exit code.\nError: ${error}`);
      }
    } catch (inCommandError) {
      showOutput();
      throwContextualError(`In-command error caught: ${inCommandError}`);
    }

    return result;
  }
}

export default System;
