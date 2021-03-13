import NotImplementedException from './not-implemented-exception';

describe('NotImplementedException', () => {
  it('instantiates', () => {
    expect(() => new NotImplementedException()).not.toThrow();
  });

  test.each(['one'])('Displays title %s', (message) => {
    const error = new NotImplementedException(message);

    expect(error.name).toStrictEqual('NotImplementedException');
    expect(error.message).toStrictEqual(message.toString());
  });
});
