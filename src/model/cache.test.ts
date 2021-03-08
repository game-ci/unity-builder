import Cache from './cache';

jest.mock('./input');

describe('Cache', () => {
  describe('Verification', () => {
    it('does not throw', () => {
      expect(() => Cache.verify()).not.toThrow();
    });
  });
});
