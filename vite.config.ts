import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// In dev, /api is proxied to `wrangler pages dev` (port 8788), which runs the
// Pages Functions against a local D1 database and R2 bucket.
export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    proxy: { '/api': 'http://localhost:8788' },
  },
  test: { include: ['src/**/*.test.ts'] },
} as never);
