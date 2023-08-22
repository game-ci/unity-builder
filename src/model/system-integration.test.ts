import * as core from '@actions/core';
import System from './system';

jest.spyOn(core, 'debug').mockImplementation(() => {});
jest.spyOn(core, 'info').mockImplementation(() => {});
jest.spyOn(core, 'warning').mockImplementation(() => {});
jest.spyOn(core, 'error').mockImplementation(() => {});

afterEach(() => jest.clearAllMocks());

describe('System', () => {
  describe('run', () => {
    /**
     * Not all shells (e.g. Powershell, sh) have a reference to `echo` binary (absent or alias).
     * To ensure our integration with '@actions/exec' works as expected we run some specific tests in CI only
     */
    describe('integration', () => {
      if (!process.env.CI) {
        it("doesn't run locally", () => {
          expect(true).toBe(true);
        });
      } else {
        it('runs a command successfully', async () => {
          await expect(System.run('true')).resolves.not.toBeNull();
        });

        it('outputs results', async () => {
          await expect(System.run('echo test')).resolves.toStrictEqual('test\n');
        });

        it('throws on when error code is not 0', async () => {
          await expect(System.run('false')).rejects.toThrowError();
        });

        it('allows pipes using buffer', async () => {
          await expect(
            System.run('sh', undefined, {
              input: Buffer.from('git tag --list --merged HEAD | grep v[0-9]* | wc -l'),
              // eslint-disable-next-line github/no-then
            }).then((result) => Number(result)),
          ).resolves.not.toBeNaN();
        });
      }
    });
  });
});
