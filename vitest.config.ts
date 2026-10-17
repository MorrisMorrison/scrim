import { configDefaults, defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['tests/**/*.test.ts'],
    // Benchmarks run on demand with `pnpm bench` (vitest.bench.config.ts).
    exclude: [...configDefaults.exclude, 'tests/bench/**'],
    environment: 'node',
  },
});
