import * as Index from '.';

describe('Index', () => {
  test.each([
    'Action',
    'BuildParameters',
    'Cache',
    'Docker',
    'ImageTag',
    'Input',
    'Platform',
    'Project',
    'Unity',
  ])('exports %s', exportedModule => {
    expect(typeof Index[exportedModule]).toStrictEqual('function');
  });
});
