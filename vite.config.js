import { defineConfig } from 'vite';

// Project Pages: https://connect-world-1985-ai.github.io/2026-10-25-jiangnan-rainy-night-demo-grok47/
export default defineConfig({
  base: '/2026-10-25-jiangnan-rainy-night-demo-grok47/',
  build: {
    target: 'es2020',
    chunkSizeWarningLimit: 900,
  },
  server: {
    host: true,
    port: 5173,
  },
});
