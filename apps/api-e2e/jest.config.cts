const { readFileSync } = require('fs');

const swcJestConfig = JSON.parse(readFileSync(`${__dirname}/.spec.swcrc`, 'utf-8'));
swcJestConfig.swcrc = false;
swcJestConfig.module = { type: 'commonjs' };

module.exports = {
  displayName: '@tribunal/api-e2e',
  testEnvironment: 'node',
  rootDir: '.',
  moduleFileExtensions: ['ts', 'js', 'json'],
  testMatch: ['<rootDir>/src/**/*.e2e-spec.ts'],
  testTimeout: 60000,
  moduleNameMapper: {
    '^@tribunal/shared-types$': '<rootDir>/../../libs/shared-types/dist/index.js',
  },
  transform: {
    '^.+\\.[tj]s$': ['@swc/jest', swcJestConfig],
  },
  transformIgnorePatterns: ['/node_modules/'],
  coverageDirectory: 'test-output/jest/coverage',
};
