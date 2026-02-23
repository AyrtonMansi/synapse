import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    name: 'unit',
    include: ['**/*.spec.ts'],
    exclude: ['**/node_modules/**', '**/dist/**', 'integration/**', 'security/**', 'performance/**'],
    globals: true,
    environment: 'node',
    testTimeout: 10000,
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html', 'lcov'],
      reportsDirectory: './reports/coverage/unit',
      thresholds: {
        lines: 80,
        functions: 80,
        branches: 75,
        statements: 80,
      },
    },
    reporters: [
      'default',
      ['json', { outputFile: './reports/unit-results.json' }],
    ],
  },
});
