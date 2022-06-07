import { stat } from 'https://deno.land/std@0.142.0/node/fs/promises/mod.ts';

describe('Integrity tests', () => {
  describe('package-lock.json', () => {
    it('does not exist', async () => {
      await expect(stat(`${process.cwd()}/package-lock.json`)).rejects.toThrowError();
    });
  });
});
