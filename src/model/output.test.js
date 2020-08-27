import Output from './output';

describe('Output', () => {
  describe('setBuildVersion', () => {
    it('does not throw', async () => {
      await expect(Output.setBuildVersion('1.0.0')).resolves.not.toThrow();
    });
  });
});
