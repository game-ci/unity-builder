import Cache from './cache';

describe('Cache', () => {
  describe('keys', () => {
    it('returns a string', () => {
      expect(typeof Cache.libraryKey).toBe('string');
    });
  });
});
