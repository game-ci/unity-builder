expect.extend({
  toBeOfType(received, expectedType) {
    const type = typeof received;

    const pass = type === expectedType;
    const message = () => `
      Expected value to be of type ${this.utils.printExpected(expectedType)},
      but received ${this.utils.printReceived(type)}`;

    return {
      message,
      pass,
    };
  },

  toBeEitherAFunctionOrAnObject(received) {
    const type = typeof received;

    const pass = ['object', 'function'].includes(type);
    const message = () => `Expected a ${this.utils.printExpected('function')}
      or an ${this.utils.printExpected('object')},
      but received ${type}`;

    return {
      message,
      pass,
    };
  },

  toBeParsableToANumber(received) {
    let pass = false;
    let errorMessage = '';

    try {
      Number.parseInt(received, 10);
      pass = true;
    } catch (error) {
      errorMessage = error;
    }

    const message = () => `Expected ${this.utils.printExpected(received)} to be parsable as a number
      , but received error: ${this.utils.printReceived(errorMessage)}.`;

    return {
      message,
      pass,
    };
  },
});
