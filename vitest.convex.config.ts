import { defineConfig } from 'vitest/config'

// convex-test runs Convex functions in-process, so it needs the edge-runtime
// environment (Web Crypto, fetch, Response, atob/btoa) and convex-test inlined.
// Kept separate from vitest.config.ts so the fast `npm test` (domain logic,
// node env) is untouched; run these with `npm run test:convex`.
export default defineConfig({
  test: {
    environment: 'edge-runtime',
    include: ['convex/**/*.test.ts'],
    server: {
      deps: {
        inline: ['convex-test'],
      },
    },
  },
})
