/** @type {import('ts-jest').JestConfigWithTsJest} */
module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  roots: ['<rootDir>/src', '<rootDir>/packages'],
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/src/$1',
    '^@gastapp/shared$': '<rootDir>/packages/shared/index.ts',
  },
  testMatch: ['**/__tests__/**/*.test.ts'],
  transform: {
    '^.+\\.tsx?$': [
      'ts-jest',
      {
        tsconfig: {
          strict: true,
          module: 'commonjs',
          target: 'es2020',
          moduleResolution: 'node',
          paths: {
            '@/*': ['src/*'],
            '@gastapp/shared': ['packages/shared/index.ts'],
          },
        },
      },
    ],
  },
};
