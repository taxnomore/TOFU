// Packs the built client (dist/) into one self-contained HTML file that opens
// with a double click (file://): code, styles, fonts and icon are inlined, so
// the browser loads nothing else. Solo and same-PC split screen work from it;
// LAN play still needs the small server (npm run start).
import fs from 'node:fs';
import path from 'node:path';

const DIST = 'dist';
const OUT = path.join(DIST, 'tofu-qui-a-fait-ca.html');

const read = (rel) => fs.readFileSync(path.join(DIST, rel));
const dataUri = (buf, mime) => `data:${mime};base64,${buf.toString('base64')}`;
const favicon = dataUri(read('favicon.svg'), 'image/svg+xml');

let html = read('index.html').toString('utf8');
let inlined = 0;

// Styles, with the fonts as data URIs (woff2 only; the Hebrew subset is never displayed).
html = html.replace(/<link rel="stylesheet"[^>]*href="\.\/(assets\/[^"]+\.css)"[^>]*>/, (_, rel) => {
  let css = read(rel).toString('utf8');
  css = css.replace(/@font-face\{[^}]*hebrew[^}]*\}/g, '');
  css = css.replace(/,\s*url\((?:data:font\/woff;base64,[^)]*|[^)]*\.woff)\)\s*format\("woff"\)/g, '');
  css = css.replace(/url\((?:\.\/)?([^)":]+\.woff2)\)/g, (m, file) => `url(${dataUri(read(path.join('assets', path.basename(file))), 'font/woff2')})`);
  inlined++;
  return `<style>\n${css}\n</style>`;
});

// Game code as an inline module (nothing to fetch, so file:// is fine).
html = html.replace(/<script type="module"[^>]*src="\.\/(assets\/[^"]+\.js)"[^>]*><\/script>/, (_, rel) => {
  let js = read(rel).toString('utf8');
  js = js.replaceAll('./favicon.svg', favicon);
  // A literal "</script" would end the inline script early.
  js = js.replace(/<\/script/gi, '<\\/script');
  inlined++;
  return `<script type="module">\n${js}\n</script>`;
});

html = html.replace(/<link rel="icon"[^>]*>/, `<link rel="icon" href="${favicon}" type="image/svg+xml" />`);
html = html.replace(/\s*<link rel="manifest"[^>]*>/, '');

if (inlined !== 2 || /(src|href)="\.\//.test(html)) {
  console.error('build-single : une ressource n\'a pas pu être intégrée dans le fichier HTML.');
  process.exit(1);
}
fs.writeFileSync(OUT, html);
console.log(`  ${OUT}  ${(fs.statSync(OUT).size / 1024).toFixed(0)} ko (s'ouvre d'un double clic)`);
