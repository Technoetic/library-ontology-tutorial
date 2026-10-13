import { defineConfig } from 'vite';
export default defineConfig({
  base: '/library-ontology-tutorial/',
  build: { target: 'es2022' },
  test: { include: ['tests/**/*.test.js'], testTimeout: 30000, hookTimeout: 60000, maxWorkers: 2 },
});
