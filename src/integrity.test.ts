import { stat } from 'node:fs/promises';

describe('Integrity tests', () => {
  describe('package-lock.json', () => {
    it('does not exist', async () => {
      await expect(stat(`${process.cwd()}/package-lock.json`)).rejects.toThrowError();
    });
  });
});
