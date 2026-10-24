// vitest.config.js
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    // Use the Node environment (no DOM emulation)
    environment: 'node',

    // Load test env vars before any test file runs
    setupFiles: ['./src/tests/setup.js'],

    // Run test files sequentially — integration tests share a DB connection
    // and we use per-test transactions, so parallel is safe, but sequential
    // avoids port/connection pool exhaustion on CI.
    isolate: false,

    // Coverage config (used when running: npm run test:coverage)
    coverage: {
      provider: 'v8',
      reporter: ['text', 'lcov', 'html'],
      reportsDirectory: './coverage',
      exclude: [
        'node_modules/**',
        'prisma/**',
        'coverage/**',
        'vitest.config.js',
        'src/tests/**',
      ],
      // Enforce minimum thresholds
      thresholds: {
        lines: 70,
        functions: 70,
        branches: 60,
        statements: 70,
      },
    },

    // Increase timeout for integration tests that hit the real DB
    testTimeout: 15000,
  },
});
