import { defineConfig } from 'vite';

// Client build configuration. The dev server is not started by Vite's CLI:
// `npm run dev` runs server/main.ts, which mounts Vite in middleware mode next
// to the WebSocket game server (single port for page + LAN sessions).
export default defineConfig({
  root: '.',
  publicDir: 'public',
  base: './',
  build: {
    outDir: 'dist',
    emptyOutDir: true,
    target: 'es2020',
    chunkSizeWarningLimit: 1500,
    sourcemap: false,
  },
  test: {
    include: ['tests/**/*.test.ts'],
    environment: 'node',
    testTimeout: 60000,
  },
} as any);
