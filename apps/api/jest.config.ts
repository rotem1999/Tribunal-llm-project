/**
 * Jest configuration for the api backend unit-test suite (SPEC §14.2).
 *
 * DB-free, deterministic unit tests only: no real Postgres, no real network,
 * no real OpenRouter. TypeScript + NestJS decorators are compiled by
 * `@swc/jest` (legacy decorators + emitted metadata), matching the api
 * tsconfig's `experimentalDecorators` / `emitDecoratorMetadata`.
 */
const swcJestConfig = {
  jsc: {
    parser: {
      syntax: 'typescript',
      tsx: false,
      decorators: true,
      dynamicImport: true,
    },
    transform: {
      legacyDecorator: true,
      decoratorMetadata: true,
    },
    target: 'es2021',
    keepClassNames: true,
    loose: false,
  },
  module: {
    type: 'commonjs',
  },
  sourceMaps: 'inline',
};

export default {
  displayName: 'api',
  testEnvironment: 'node',
  rootDir: '.',
  roots: ['<rootDir>/src'],
  moduleFileExtensions: ['ts', 'js', 'json'],
  testMatch: ['<rootDir>/src/**/*.spec.ts'],
  setupFiles: ['<rootDir>/test/jest.setup.ts'],
  moduleNameMapper: {
    // Resolve the shared contract lib to its built ESM entry; @swc/jest
    // transpiles it to CJS on the fly (it lives outside node_modules).
    '^@tribunal/shared-types$':
      '<rootDir>/../../libs/shared-types/dist/index.js',
  },
  transform: {
    '^.+\\.(t|j)sx?$': ['@swc/jest', swcJestConfig],
  },
  // The shared-types dist is real-pathed outside node_modules and must be
  // transpiled from ESM; everything else in node_modules is ignored.
  transformIgnorePatterns: ['/node_modules/'],
  clearMocks: true,
  resetMocks: false,
  restoreMocks: true,
  coverageDirectory: '<rootDir>/test-output/jest/coverage',
  collectCoverageFrom: [
    '<rootDir>/src/tribunal/**/*.ts',
    '<rootDir>/src/openrouter/**/*.ts',
    '<rootDir>/src/economy/economy.builder.ts',
    '<rootDir>/src/personas/personas.schema.ts',
    '<rootDir>/src/users/users.service.ts',
    '<rootDir>/src/auth/auth.service.ts',
    '!<rootDir>/src/**/*.module.ts',
    '!<rootDir>/src/**/*.controller.ts',
    // The run orchestrator is DB/integration-bound (out of SPEC §14.2 unit scope).
    '!<rootDir>/src/tribunal/tribunal.service.ts',
  ],
};
