import * as Index from './index.ts';

describe('Index', () => {
  test.each(['Action', 'BuildParameters', 'Cache', 'Docker', 'ImageTag', 'Input', 'Platform', 'Project', 'Unity'])(
    'exports %s',
    (exportedModule) => {
      expect(Index[exportedModule]).toBeDefined();
    },
  );
});
