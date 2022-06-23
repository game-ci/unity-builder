/* eslint-disable no-console */

export const core = {
  info: console.log,

  warning: console.warn,

  error: (error) => {
    console.error(error, error.stack);
  },

  setFailed: (failure) => {
    console.error('setFailed:', failure);
    Deno.exit(1);
  },

  // Adapted from: https://github.com/actions/toolkit/blob/9b7bcb1567c9b7f134eb3c2d6bbf409a5106a956/packages/core/src/core.ts#L128
  getInput: (name, options) => {
    const variable = `INPUT_${name.replace(/ /g, '_').toUpperCase()}`;
    const value: string = Deno.env.get(variable) || '';

    if (options?.required && !value) {
      throw new Error(`Input required and not supplied: ${name}`);
    }

    if (options?.trimWhitespace === false) {
      return value;
    }

    return value.trim();
  },
};
