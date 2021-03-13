import * as core from '@actions/core';
import { exec } from '@actions/exec';

class System {
  static async run(command, arguments_: any = [], options = {}) {
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
      if (debug !== '') {
        core.debug(debug);
      }

      if (result !== '') {
        core.info(result);
      }

      if (error !== '') {
        core.warning(error);
      }
    };

    const throwContextualError = (message) => {
      let commandAsString = command;
      if (Array.isArray(arguments_)) {
        commandAsString += ` ${arguments_.join(' ')}`;
      } else if (typeof arguments_ === 'string') {
        commandAsString += ` ${arguments_}`;
      }

      throw new Error(`Failed to run "${commandAsString}".\n ${message}`);
    };

    try {
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
