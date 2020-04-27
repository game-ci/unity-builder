import Input from './input';
import Versioning from './versioning';

const determineVersion = jest
  .spyOn(Versioning, 'determineVersion')
  .mockImplementation(() => '1.3.37');

afterEach(() => {
  jest.clearAllMocks();
});

describe('Input', () => {
  describe('getFromUser', () => {
    it('does not throw', async () => {
      await expect(Input.getFromUser()).resolves.not.toBeNull();
    });

    it('returns an object', async () => {
      await expect(typeof (await Input.getFromUser())).toStrictEqual('object');
    });

    it('calls version generator once', async () => {
      await Input.getFromUser();
      expect(determineVersion).toHaveBeenCalledTimes(1);
    });
  });
});
