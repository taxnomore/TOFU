// Local game server: serves the web client and hosts LAN sessions over
// WebSockets on the same port. `npm run dev` mounts Vite (hot reload),
// `npm run start` serves the production build from dist/.
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { WebSocketServer } from 'ws';
import { lanAddresses } from './net-util';
import { Room } from './room';

const DEV = process.argv.includes('--dev');
const PORT = Number(process.env.PORT ?? 8080);
const HOST = process.env.HOST ?? '0.0.0.0';
const here = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(here, '..');
const DIST = path.join(ROOT, 'dist');

const MIME: Record<string, string> = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.webmanifest': 'application/manifest+json',
  '.woff2': 'font/woff2',
  '.txt': 'text/plain; charset=utf-8',
};

function serveStatic(req: http.IncomingMessage, res: http.ServerResponse): void {
  const url = new URL(req.url ?? '/', 'http://x');
  let p = decodeURIComponent(url.pathname);
  if (p.endsWith('/')) p += 'index.html';
  const file = path.normalize(path.join(DIST, p));
  if (!file.startsWith(DIST)) {
    res.writeHead(403).end();
    return;
  }
  fs.stat(file, (err, st) => {
    const target = !err && st.isFile() ? file : path.join(DIST, 'index.html');
    fs.readFile(target, (e2, data) => {
      if (e2) {
        res.writeHead(404, { 'content-type': 'text/plain; charset=utf-8' }).end(
          'Build introuvable. Lancez « npm run build » puis « npm run start », ou utilisez « npm run dev ».',
        );
        return;
      }
      const ext = path.extname(target);
      const immutable = target.includes(`${path.sep}assets${path.sep}`);
      res.writeHead(200, {
        'content-type': MIME[ext] ?? 'application/octet-stream',
        'cache-control': immutable ? 'public, max-age=31536000, immutable' : 'no-cache',
      });
      res.end(data);
    });
  });
}

function info() {
  const ips = lanAddresses();
  return {
    port: PORT,
    lanUrls: ips.map((ip) => `http://${ip}:${PORT}/`),
    version: '0.1.0',
  };
}

async function main() {
  const room = new Room();
  let viteMiddleware: ((req: http.IncomingMessage, res: http.ServerResponse, next: () => void) => void) | null = null;
  const server = http.createServer((req, res) => {
    if (req.url?.startsWith('/api/info')) {
      res.writeHead(200, { 'content-type': 'application/json', 'cache-control': 'no-store' });
      res.end(JSON.stringify(info()));
      return;
    }
    if (viteMiddleware) {
      viteMiddleware(req, res, () => {
        res.writeHead(404).end();
      });
      return;
    }
    serveStatic(req, res);
  });

  if (DEV) {
    const { createServer } = await import('vite');
    const vite = await createServer({
      root: ROOT,
      server: { middlewareMode: true, hmr: { server } },
      appType: 'spa',
    });
    viteMiddleware = vite.middlewares;
  }

  const wss = new WebSocketServer({ noServer: true, maxPayload: 64 * 1024 });
  server.on('upgrade', (req, socket, head) => {
    const url = new URL(req.url ?? '/', 'http://x');
    if (url.pathname !== '/ws') return; // other upgrades (Vite HMR) are handled elsewhere
    wss.handleUpgrade(req, socket, head, (ws) => room.connect(ws, req.socket.remoteAddress ?? ''));
  });

  server.on('error', (e: NodeJS.ErrnoException) => {
    if (e.code === 'EADDRINUSE') {
      console.error(`\n  Le port ${PORT} est déjà utilisé. Fermez l'autre programme ou lancez avec PORT=8081 npm run ${DEV ? 'dev' : 'start'}.\n`);
      process.exit(1);
    }
    throw e;
  });

  server.listen(PORT, HOST, () => {
    const i = info();
    const line = '─'.repeat(58);
    console.log(`\n  ${line}`);
    console.log('   🐶  TOFU ! QUI A FAIT ÇA ?  est prêt !');
    console.log(`  ${line}`);
    console.log(`   Sur ce PC          : http://localhost:${PORT}/`);
    if (i.lanUrls.length) {
      console.log(`   Téléphones (Wi-Fi) : ${i.lanUrls[0]}`);
      for (const u of i.lanUrls.slice(1)) console.log(`                        ${u}`);
    } else {
      console.log('   Réseau local       : aucune adresse trouvée (PC hors Wi-Fi ?)');
    }
    console.log(`   Mode               : ${DEV ? 'développement (rechargement auto)' : 'production'}`);
    console.log(`  ${line}`);
    console.log('   Astuce : si les téléphones ne se connectent pas, autorisez le');
    console.log(`   port ${PORT} (TCP) dans le pare-feu, par ex. « sudo ufw allow ${PORT}/tcp ».`);
    console.log(`  ${line}\n`);
  });
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
