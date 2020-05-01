import * as core from '@actions/core';
import { exec } from '@actions/exec';

class System {
  static async run(command, arguments_, options) {
    let result = '';
    let error = '';
    let debug = '';

    const listeners = {
      stdout: dataBuffer => {
        result += dataBuffer.toString();
      },
      stderr: dataBuffer => {
        error += dataBuffer.toString();
      },
      debug: dataString => {
        debug += dataString.toString();
      },
    };

    const exitCode = await exec(command, arguments_, { ...options, listeners });

    if (debug !== '') {
      core.debug(debug);
    }

    if (result !== '') {
      core.info(result);
    }

    if (exitCode !== 0) {
      throw new Error(error);
    }

    if (error !== '') {
      core.warning(error);
    }

    return result;
  }
}

export default System;
