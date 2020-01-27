import * as Index from '.';

describe('Index', () => {
  test.each(['Action', 'BuildParameters', 'Cache', 'Docker', 'Input', 'ImageTag', 'Platform'])(
    'exports %s',
    exportedModule => {
      expect(typeof Index[exportedModule]).toStrictEqual('function');
    },
  );
});
