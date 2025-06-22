module.exports = {
  // Use ts-jest for TypeScript support
  preset: 'ts-jest',
  
  // Test environment
  testEnvironment: 'jsdom',
  
  // Module paths
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/src/$1',
    '^eghact$': '<rootDir>/src/index.ts',
    '^eghact/(.*)$': '<rootDir>/src/$1',
    '\\.(css|less|scss|sass)$': 'identity-obj-proxy',
  },
  
  // File extensions
  moduleFileExtensions: ['ts', 'tsx', 'js', 'jsx', 'egh'],
  
  // Transform configuration
  transform: {
    '^.+\\.tsx?$': 'ts-jest',
    '^.+\\.egh$': '<rootDir>/src/testing/egh-transformer.js',
  },
  
  // Setup files
  setupFilesAfterEnv: ['<rootDir>/src/testing/jest-setup.ts'],
  
  // Coverage configuration
  collectCoverageFrom: [
    'src/**/*.{ts,tsx,egh}',
    '!src/**/*.d.ts',
    '!src/**/*.test.{ts,tsx}',
    '!src/testing/**',
  ],
  
  // Test match patterns
  testMatch: [
    '**/__tests__/**/*.{ts,tsx}',
    '**/*.test.{ts,tsx}',
    '**/*.spec.{ts,tsx}',
  ],
  
  // Ignore patterns
  testPathIgnorePatterns: [
    '/node_modules/',
    '/dist/',
    '/build/',
  ],
  
  // Global settings
  globals: {
    'ts-jest': {
      tsconfig: {
        jsx: 'react',
        esModuleInterop: true,
        allowSyntheticDefaultImports: true,
      },
    },
  },
  
  // Performance settings
  maxWorkers: '50%',
  
  // Snapshot serializers
  snapshotSerializers: ['<rootDir>/src/testing/egh-snapshot-serializer.js'],
};