/* eslint-disable @typescript-eslint/no-var-requires */

process.env.NODE_ENV = 'test';

module.exports = wallaby => ({
  files: [
    'src/**/*.ts',
    'jest.config.js',
    'test/avatar.png',
    'test/profile.jpg',
  ],
  tests: ['test/**/*.test.ts'],
  testFramework: 'jest',
  env: {
    type: 'node',
    runner: 'node',
  },
  // setup: function(wallaby) {
  //   const jestConfig = require('./backend/jest.config');
  //   wallaby.testFramework.configure(jestConfig);
  // },
  setup: function(wallaby) {
    const jestConfig = require('./jest.config');
    wallaby.testFramework.configure(jestConfig);
  },
  workers: {
    initial: 1,
    regular: 1,
  },
});
