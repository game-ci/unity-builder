import { fs } from '../dependencies.ts';

describe('Integrity tests', () => {
  describe('package-lock.json', () => {
    it('does not exist', async () => {
      await expect(fs.stat(`${process.cwd()}/package-lock.json`)).rejects.toThrowError();
    });
  });
});
