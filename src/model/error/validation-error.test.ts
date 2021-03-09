import ValidationError from './validation-error';

describe('ValidationError', () => {
  it('instantiates', () => {
    expect(() => new ValidationError()).not.toThrow();
  });

  test.each(['one'])('Displays title %s', (message) => {
    const error = new ValidationError(message);

    expect(error.name).toStrictEqual('ValidationError');
    expect(error.message).toStrictEqual(message.toString());
  });
});
