// Play over the Internet from this PC, with no account and no router setting.
// Starts a Cloudflare "quick tunnel" (free, no account; the small cloudflared
// program must be installed), then the game server in Internet mode, and
// prints the public link to share.
//
//   npm run build        (once)
//   npm run internet
//
// Environment: PORT (default 8080), CLOUDFLARED (path to the program).
import { spawn, spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const PORT = Number(process.env.PORT ?? 8080);
const BIN = process.env.CLOUDFLARED || 'cloudflared';
const SERVER = path.join(ROOT, 'dist-server', 'main.js');

if (!fs.existsSync(SERVER) || !fs.existsSync(path.join(ROOT, 'dist', 'index.html'))) {
  console.error('\n  Le jeu n\'est pas construit. Lancez d\'abord « npm run build ».\n');
  process.exit(1);
}

if (spawnSync(BIN, ['--version'], { encoding: 'utf8' }).error) {
  console.error(`
  Il manque le programme gratuit « cloudflared » (de Cloudflare), qui crée le lien public.
  Installation :
    Windows : winget install --id Cloudflare.cloudflared
    macOS   : brew install cloudflared
    Linux   : https://github.com/cloudflare/cloudflared/releases/latest
              (Ubuntu, Debian : fichier cloudflared-linux-amd64.deb ;
               Fedora : fichier cloudflared-linux-x86_64.rpm)
  Relancez ensuite « npm run internet ».
  Autre solution, sans Cloudflare : votre propre serveur (README, « Jouer par Internet »).
`);
  process.exit(1);
}

console.log('\n  Création du lien public (quelques secondes)…');
const tunnel = spawn(BIN, ['tunnel', '--no-autoupdate', '--url', `http://127.0.0.1:${PORT}`], { stdio: ['ignore', 'pipe', 'pipe'] });
let server = null;
let url = '';
let log = '';
let stopping = false;

const onData = (buf) => {
  const text = String(buf);
  log = (log + text).slice(-4000);
  const m = text.match(/https:\/\/[a-z0-9-]+\.trycloudflare\.com/);
  if (m && !url) {
    url = m[0];
    startServer();
  }
};
tunnel.stdout.on('data', onData);
tunnel.stderr.on('data', onData);
tunnel.on('error', () => undefined);
tunnel.on('exit', (code) => {
  if (stopping) return;
  console.error(`\n  Le tunnel s'est arrêté (code ${code}). Ses derniers messages :\n${log.split('\n').slice(-8).join('\n')}`);
  stop(1);
});

const timer = setTimeout(() => {
  if (url) return;
  console.error('\n  Pas de lien public au bout de 45 secondes. Vérifiez la connexion Internet, puis relancez.');
  stop(1);
}, 45_000);

function startServer() {
  clearTimeout(timer);
  // Only the tunnel reaches the server; it gives the players' addresses in its headers.
  server = spawn(process.execPath, [SERVER, '--internet'], {
    stdio: 'inherit',
    env: { ...process.env, PORT: String(PORT), HOST: '127.0.0.1', PUBLIC_URL: url, TRUST_PROXY: '1', TOFU_MODE: 'internet' },
  });
  server.on('exit', (code) => {
    if (!stopping) stop(code ?? 1);
  });
  setTimeout(() => void banner(), 1000);
}

async function banner() {
  if (stopping) return;
  const line = '─'.repeat(58);
  console.log(`  ${line}`);
  console.log(`   🌍  Lien public : ${url}`);
  console.log(`  ${line}`);
  console.log('   1. Ouvrez ce lien, puis « Jouer en ligne » → « Créer un salon ».');
  console.log('   2. Le salon affiche son propre lien (avec le code) : envoyez-le');
  console.log('      aux autres joueurs, par message ou par e-mail.');
  console.log('   Le lien change à chaque lancement. Ctrl+C arrête tout.');
  console.log(`  ${line}`);
  try {
    // Scan with a phone; only when the development packages are installed.
    const { default: qrcode } = await import('qrcode-generator');
    const qr = qrcode(0, 'L');
    qr.addData(url);
    qr.make();
    console.log(qr.createASCII(1, 2));
  } catch {
    /* no QR code in the terminal */
  }
}

function stop(code) {
  if (stopping) return;
  stopping = true;
  clearTimeout(timer);
  tunnel.kill();
  server?.kill();
  setTimeout(() => process.exit(code), 300);
}

process.on('SIGINT', () => stop(0));
process.on('SIGTERM', () => stop(0));
