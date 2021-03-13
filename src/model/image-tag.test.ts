import ImageTag from './image-tag';

describe('ImageTag', () => {
  const some = {
    repository: 'test1',
    name: 'test2',
    version: '2099.9.f9f9',
    platform: 'Test',
    builderPlatform: '',
  };

  const defaults = {
    repository: 'unityci',
    name: 'editor',
    image: 'unityci/editor',
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

    test.each(['2000.0.0f0', '2011.1.11f1'])('accepts %p version format', (version) => {
      expect(() => new ImageTag({ version, platform: some.platform })).not.toThrow();
    });

    test.each(['some version', '', 1])('throws for incorrect versions %p', (version) => {
      const { platform } = some;
      expect(() => new ImageTag({ version, platform })).toThrow();
    });

    test.each([undefined, 'nonExisting'])('throws for unsupported target %p', (platform) => {
      expect(() => new ImageTag({ platform })).toThrow();
    });
  });

  describe('toString', () => {
    it('returns the correct version', () => {
      const image = new ImageTag({ version: '2099.1.1111', platform: some.platform });

      expect(image.toString()).toStrictEqual(`${defaults.image}:2099.1.1111-0`);
    });
    it('returns customImage if given', () => {
      const image = new ImageTag({
        version: '2099.1.1111',
        platform: some.platform,
        customImage: `${defaults.image}:2099.1.1111@347598437689743986`,
      });

      expect(image.toString()).toStrictEqual(image.customImage);
    });

    it('returns the specific build platform', () => {
      const image = new ImageTag({ version: '2019.2.11f1', platform: 'WebGL' });

      expect(image.toString()).toStrictEqual(`${defaults.image}:2019.2.11f1-webgl-0`);
    });

    it('returns no specific build platform for generic targetPlatforms', () => {
      const image = new ImageTag({ platform: 'NoTarget' });

      expect(image.toString()).toStrictEqual(`${defaults.image}:2019.2.11f1-0`);
    });
  });
});
