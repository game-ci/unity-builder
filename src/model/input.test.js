import { mockDetermineVersion } from './__mocks__/versioning';
import Input from './input';

jest.restoreAllMocks();
jest.mock('./versioning');

beforeEach(() => {
  mockDetermineVersion.mockClear();
});

describe('Input', () => {
  describe('getFromUser', () => {
    it('does not throw', async () => {
      await expect(Input.getFromUser()).resolves.not.toBeNull();
    });

    it('returns an object', async () => {
      await expect(typeof (await Input.getFromUser())).toStrictEqual('object');
    });

    it.skip('calls version generator once', async () => {
      await Input.getFromUser();

      // Todo - make sure the versioning mock is actually hit after restoreAllMocks is used.
      expect(mockDetermineVersion).toHaveBeenCalledTimes(1);
    });
  });
});
