import { exec } from '@actions/exec';

class System {
  static async run(command, arguments_, options) {
    let result = '';
    let error = '';

    const listeners = {
      stdout: dataBuffer => {
        result += dataBuffer.toString();
      },
      stderr: dataBuffer => {
        error += dataBuffer.toString();
      },
    };

    const exitCode = await exec(command, arguments_, { ...options, listeners });
    if (exitCode !== 0) {
      throw new Error(error);
    }

    return result;
  }
}

export default System;
