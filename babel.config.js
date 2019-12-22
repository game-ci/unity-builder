const esModules = ['lodash-es'].join('|');

module.exports = {
  ignore: [`/node_modules/(?!${esModules})`],
  presets: [
    [
      '@babel/preset-env',
      {
        targets: {
          node: true,
        },
      },
    ],
  ],
};
