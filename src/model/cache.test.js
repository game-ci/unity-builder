import Cache from './cache';

describe('Cache', () => {
  describe('Verification', () => {
    it('does not throw', () => {
      expect(() => Cache.verify()).not.toThrow();
    });
  });
});
