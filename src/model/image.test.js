import Image from './image';

describe('UnityImageVersion', () => {
  const some = {
    repository: 'test1',
    name: 'test2',
    version: '2099.9.f9f9',
    targetPlatform: 'Stadia',
    builderPlatform: '',
  };

  const defaults = {
    repository: 'gableroux',
    name: 'unity3d',
    image: 'gableroux/unity3d',
  };

  describe('constructor', () => {
    it('can be called', () => {
      expect(() => new Image({ targetPlatform: some.targetPlatform })).not.toThrow();
    });

    it('accepts parameters and sets the right properties', () => {
      const image = new Image(some);

      expect(image.repository).toStrictEqual(some.repository);
      expect(image.name).toStrictEqual(some.name);
      expect(image.version).toStrictEqual(some.version);
      expect(image.targetPlatform).toStrictEqual(some.targetPlatform);
      expect(image.builderPlatform).toStrictEqual(some.builderPlatform);
    });

    it('throws for incorrect versions', () => {
      const { targetPlatform } = some;
      expect(() => new Image({ version: 'some version', targetPlatform })).toThrow();
      expect(() => new Image({ version: '', targetPlatform })).toThrow();
      expect(() => new Image({ version: 1, targetPlatform })).toThrow();
      expect(() => new Image({ version: null, targetPlatform })).toThrow();
    });

    it('throws for incorrect or unsupported targets', () => {
      expect(() => new Image({ targetPlatform: undefined })).toThrow();
      expect(() => new Image({ targetPlatform: 'nonExisting' })).toThrow();
    });
  });

  describe('toString', () => {
    it('returns the correct version', () => {
      const image = new Image({ version: '2099.1.1111', targetPlatform: some.targetPlatform });

      expect(image.toString()).toStrictEqual(`${defaults.image}:2099.1.1111`);
    });

    it('returns the specific build platform', () => {
      const image = new Image({ version: '2019.2.11f1', targetPlatform: 'WebGL' });

      expect(image.toString()).toStrictEqual(`${defaults.image}:2019.2.11f1-webgl`);
    });

    it('returns no specific build platform for generic targetPlatforms', () => {
      const image = new Image({ targetPlatform: 'Stadia' });

      expect(image.toString()).toStrictEqual(`${defaults.image}:2019.2.11f1`);
    });
  });
});
