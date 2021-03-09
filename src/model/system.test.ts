import * as core from '@actions/core';
import System from './system';

jest.spyOn(core, 'debug').mockImplementation(() => {});
const info = jest.spyOn(core, 'info').mockImplementation(() => {});
jest.spyOn(core, 'warning').mockImplementation(() => {});
jest.spyOn(core, 'error').mockImplementation(() => {});

afterEach(() => {
  jest.clearAllMocks();
});

describe('System', () => {
  describe('run', () => {
    it('runs a command successfully', async () => {
      await expect(System.run('true')).resolves.not.toBeNull();
    });

    it('outputs results', async () => {
      await expect(System.run('echo test')).resolves.toStrictEqual('test\n');
    });

    it('throws on when error code is not 0', async () => {
      await expect(System.run('false')).rejects.toThrowError();
    });

    it('throws when no arguments are given', async () => {
      await expect(System.run('')).rejects.toThrowError();
    });

    it('outputs info', async () => {
      await expect(System.run('echo test')).resolves.not.toBeNull();
      expect(info).toHaveBeenLastCalledWith('test\n');
    });

    it('outputs info only once', async () => {
      await expect(System.run('echo 1')).resolves.not.toBeNull();
      expect(info).toHaveBeenCalledTimes(1);
      expect(info).toHaveBeenLastCalledWith('1\n');

      info.mockClear();
      await expect(System.run('echo 2')).resolves.not.toBeNull();
      await expect(System.run('echo 3')).resolves.not.toBeNull();
      expect(info).toHaveBeenCalledTimes(2);
      expect(info).toHaveBeenLastCalledWith('3\n');
    });

    it('allows pipes using buffer', async () => {
      await expect(
        System.run('sh', undefined, {
          input: Buffer.from('git tag --list --merged HEAD | grep v[0-9]* | wc -l'),
          // eslint-disable-next-line github/no-then
        }).then((result) => Number(result)),
      ).resolves.not.toBeNaN();
    });
  });
});
