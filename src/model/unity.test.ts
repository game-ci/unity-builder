import Unity from './unity';

describe('Unity', () => {
  describe('libraryFolder', () => {
    it('does not throw', () => {
      expect(() => Unity.libraryFolder).not.toThrow();
    });

    it('returns a string', () => {
      expect(typeof Unity.libraryFolder).toStrictEqual('string');
    });
  });
});
