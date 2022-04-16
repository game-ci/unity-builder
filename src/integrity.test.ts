import fs from 'fs';

describe('Integrity tests', () => {
  describe('package-lock.json', () => {
    it('does not exist', async () => {
      await expect(fs.promises.stat(`${process.cwd()}/package-lock.json`)).rejects.toThrowError();
    });
  });
});
