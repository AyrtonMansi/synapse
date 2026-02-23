import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    name: 'integration',
    include: ['integration/**/*.test.ts'],
    exclude: ['**/node_modules/**', '**/dist/**'],
    globals: true,
    environment: 'node',
    testTimeout: 60000,
    hookTimeout: 60000,
    teardownTimeout: 30000,
    maxConcurrency: 5,
    sequence: {
      hooks: 'list',
    },
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html', 'lcov'],
      reportsDirectory: './reports/coverage/integration',
      exclude: [
        'node_modules/',
        'dist/',
        '**/*.d.ts',
        'fixtures/',
        'utils/',
      ],
    },
    reporters: [
      'default',
      ['json', { outputFile: './reports/integration-results.json' }],
      ['html', { outputFile: './reports/integration-report.html' }],
    ],
  },
});
