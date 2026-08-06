/** @type {import('jest').Config} */
module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'jsdom',
  roots: ['<rootDir>/src'],
  setupFilesAfterEnv: ['<rootDir>/jest.setup.ts'],
  moduleFileExtensions: ['ts', 'tsx', 'js', 'jsx', 'json'],
  transform: {
    '^.+\\.(ts|tsx)$': [
      'ts-jest',
      {
        tsconfig: {
          jsx: 'react-jsx',
          esModuleInterop: true,
        },
      },
    ],
  },
  moduleNameMapper: {
    '\\.(css)$': 'identity-obj-proxy',
    '^@shared/(.*)$': '<rootDir>/src/shared/$1',
    '^\\.\\./shared/(.*)$': '<rootDir>/src/shared/$1',
    '^\\.\\./\\.\\./shared/(.*)$': '<rootDir>/src/shared/$1',
  },
  collectCoverageFrom: [
    'src/shared/**/*.{ts,tsx}',
    'src/aprobador/AprobadorApp.tsx',
    'src/solicitante/SolicitudesListPage.tsx',
    'src/solicitante/CreateSolicitudPage.tsx',
    '!src/**/*.d.ts',
    '!src/**/*.test.{ts,tsx}',
  ],
  coverageThreshold: {
    global: {
      branches: 45,
      functions: 55,
      lines: 60,
      statements: 60,
    },
  },
};
