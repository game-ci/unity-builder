import Project from './project';

jest.mock('./input');

describe('Platform', () => {
  describe('relativePath', () => {
    it('does not throw', () => {
      expect(() => Project.relativePath).not.toThrow();
    });

    it('returns a string', () => {
      expect(typeof Project.relativePath).toStrictEqual('string');
    });
  });

  describe('absolutePath', () => {
    it('does not throw', () => {
      expect(() => Project.absolutePath).not.toThrow();
    });

    it('returns a string', () => {
      expect(typeof Project.absolutePath).toStrictEqual('string');
    });
  });

  describe('libraryFolder', () => {
    it('does not throw', () => {
      expect(() => Project.libraryFolder).not.toThrow();
    });

    it('returns a string', () => {
      expect(typeof Project.libraryFolder).toStrictEqual('string');
    });
  });
});
