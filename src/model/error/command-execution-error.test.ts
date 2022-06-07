import CommandExecutionError from './command-execution-error.ts';

describe('CommandExecutionError', () => {
  it('instantiates', () => {
    expect(() => new CommandExecutionError()).not.toThrow();
  });

  test.each(['one'])('Displays title %s', (message) => {
    const error = new CommandExecutionError(message);

    expect(error.name).toStrictEqual('CommandExecutionError');
    expect(error.message).toStrictEqual(message.toString());
  });
});
