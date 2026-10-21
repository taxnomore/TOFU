// Bundles the Node game server (server/main.ts + shared simulation + ws) into
// dist-server/main.js. With dist/ next to it, the built game runs with Node
// alone: no `npm install` needed. Vite stays external (dev mode only), so do
// ws's optional native speed-ups.
import { build } from 'esbuild';

await build({
  entryPoints: ['server/main.ts'],
  bundle: true,
  platform: 'node',
  format: 'esm',
  target: 'node20',
  external: ['vite', 'bufferutil', 'utf-8-validate'],
  // ws is CommonJS: give its require() calls a real require in the ESM bundle.
  banner: { js: "import { createRequire as __tofuRequire } from 'node:module'; const require = __tofuRequire(import.meta.url);" },
  outfile: 'dist-server/main.js',
  define: { 'process.env.TOFU_BUILD': '"prod"' },
  logLevel: 'info',
});
