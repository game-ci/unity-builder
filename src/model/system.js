import * as core from '@actions/core';
import { exec } from '@actions/exec';

class System {
  static async run(command, arguments_, options) {
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

    const exitCode = await exec(command, arguments_, { silent: true, listeners, ...options });

    if (debug !== '') {
      core.debug(debug);
    }

    if (result !== '') {
      core.info(result);
    }

    if (error !== '') {
      core.warning(error);
    }

    if (exitCode !== 0) {
      let argumentsString = '';
      if (Array.isArray(arguments_)) {
        argumentsString += ` ${arguments_.join(' ')}`;
      }

      throw new Error(`Failed to run "${command}${argumentsString}".\n ${error}`);
    }

    return result;
  }
}

export default System;
