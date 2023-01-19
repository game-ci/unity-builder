import Output from './output';

describe('Output', () => {
  describe('setBuildVersion', () => {
    it('does not throw', async () => {
      await expect(Output.setBuildVersion('1.0.0')).resolves.not.toThrow();
    });
  });
});

describe('Output', () => {
  describe('setAndroidVersionCode', () => {
    it('does not throw', async () => {
      await expect(Output.setAndroidVersionCode('1000')).resolves.not.toThrow();
    });
  });
});
