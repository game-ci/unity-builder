expect.extend({
  toBeEitherAFunctionOrAnObject(received) {
    const type = typeof received;

    const pass = ['object', 'function'].includes(type);
    const message = `Expected a function or an object, received ${type}`;

    return {
      message,
      pass,
    };
  },
});

jest.mock('./model/input');
