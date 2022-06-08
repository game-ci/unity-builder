import { core, exec } from '../dependencies.ts';

class System {
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
        core.debug(debug);
      }

      if (result !== '' && shouldLog) {
        core.info(result);
      }

      if (error !== '' && shouldLog) {
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
