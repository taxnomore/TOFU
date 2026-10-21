// Bundles the Node game server (server/main.ts + shared simulation) into
// dist-server/main.js. npm packages (ws) stay external and load from node_modules.
import { build } from 'esbuild';

await build({
  entryPoints: ['server/main.ts'],
  bundle: true,
  platform: 'node',
  format: 'esm',
  target: 'node20',
  packages: 'external',
  outfile: 'dist-server/main.js',
  define: { 'process.env.TOFU_BUILD': '"prod"' },
  logLevel: 'info',
});
