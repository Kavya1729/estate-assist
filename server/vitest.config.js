import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    globalSetup: ['./test/globalSetup.js'],
    setupFiles: ['./test/setupEnv.js'],
    include: ['test/**/*.test.js'],
    testTimeout: 20_000,
    hookTimeout: 60_000,
  },
});
