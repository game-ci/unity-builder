const esModules = ['lodash-es'].join('|');

module.exports = {
  testEnvironment: 'node',
  moduleFileExtensions: ['js', 'jsx', 'json', 'vue'],
  transform: { '^.+\\.(js|jsx)?$': 'babel-jest' },
  transformIgnorePatterns: [`/node_modules/(?!${esModules})`],
};
