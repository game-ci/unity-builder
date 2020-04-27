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
});
