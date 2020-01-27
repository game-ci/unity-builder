import Input from './input';

describe('Input', () => {
  describe('getFromUser', () => {
    it('does not throw', () => {
      expect(() => Input.getFromUser()).not.toThrow();
    });

    it('returns an object', () => {
      expect(typeof Input.getFromUser()).toStrictEqual('object');
    });
  });
});
