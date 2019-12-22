import ImageTag from './image-tag';

describe('UnityImageVersion', () => {
  const some = {
    repository: 'test1',
    name: 'test2',
    version: '2099.9.f9f9',
    platform: 'Stadia',
    builderPlatform: '',
  };

  const defaults = {
    repository: 'gableroux',
    name: 'unity3d',
    image: 'gableroux/unity3d',
  };

  describe('constructor', () => {
    it('can be called', () => {
      const { platform } = some;
      expect(() => new ImageTag({ platform })).not.toThrow();
    });

    it('accepts parameters and sets the right properties', () => {
      const image = new ImageTag(some);

      expect(image.repository).toStrictEqual(some.repository);
      expect(image.name).toStrictEqual(some.name);
      expect(image.version).toStrictEqual(some.version);
      expect(image.platform).toStrictEqual(some.platform);
      expect(image.builderPlatform).toStrictEqual(some.builderPlatform);
    });

    it('throws for incorrect versions', () => {
      const { platform } = some;
      expect(() => new ImageTag({ version: 'some version', platform })).toThrow();
      expect(() => new ImageTag({ version: '', platform })).toThrow();
      expect(() => new ImageTag({ version: 1, platform })).toThrow();
      expect(() => new ImageTag({ version: null, platform })).toThrow();
    });

    it('throws for incorrect or unsupported targets', () => {
      expect(() => new ImageTag({ platform: undefined })).toThrow();
      expect(() => new ImageTag({ platform: 'nonExisting' })).toThrow();
    });
  });

  describe('toString', () => {
    it('returns the correct version', () => {
      const image = new ImageTag({ version: '2099.1.1111', platform: some.platform });

      expect(image.toString()).toStrictEqual(`${defaults.image}:2099.1.1111`);
    });

    it('returns the specific build platform', () => {
      const image = new ImageTag({ version: '2019.2.11f1', platform: 'WebGL' });

      expect(image.toString()).toStrictEqual(`${defaults.image}:2019.2.11f1-webgl`);
    });

    it('returns no specific build platform for generic targetPlatforms', () => {
      const image = new ImageTag({ platform: 'Stadia' });

      expect(image.toString()).toStrictEqual(`${defaults.image}:2019.2.11f1`);
    });
  });
});
