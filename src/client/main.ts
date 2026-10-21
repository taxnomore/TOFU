// Entry point: boots the renderer, menus and (optionally) the LAN client.
import '@fontsource/fredoka/500.css';
import '@fontsource/fredoka/600.css';
import '@fontsource/fredoka/700.css';
import './styles.css';
import { App } from './app';
import { Screens } from './ui/screens';
import { installLan } from './ui/lan';
import { loadKeymaps } from './input/devices';

declare global {
  interface Window {
    __started?: boolean;
    __ready?: boolean;
    /** Set by the loading screen in index.html. */
    __bootFail?: (title: string, html: string, detail?: string) => void;
    __bootTips?: () => string;
  }
}

// Tells the loading screen that the game code runs (a truncated file never gets here).
window.__started = true;

/** The game needs WebGL 2; returns why it is missing, or null when available. */
function webgl2Problem(): string | null {
  try {
    const gl = document.createElement('canvas').getContext('webgl2');
    if (!gl) return 'WebGL 2 indisponible dans ce navigateur';
    gl.getExtension('WEBGL_lose_context')?.loseContext();
    return null;
  } catch (e) {
    return String(e);
  }
}

const WEBGL_HELP = `<p>Le jeu a besoin de l'affichage 3D du navigateur (WebGL 2). Sur cet ordinateur, le navigateur l'a désactivé ou ne le trouve pas.</p><ul>
<li><b>Firefox</b> : tapez <code>about:config</code> dans la barre d'adresse et acceptez l'avertissement. Cherchez <code>webgl.force-enabled</code>, passez la valeur à <code>true</code>, puis relancez Firefox.</li>
<li><b>Chrome ou Chromium</b> : dans les Paramètres, section « Système », activez « Utiliser l'accélération graphique si disponible », puis relancez. Si cela ne suffit pas, tapez <code>chrome://flags/#ignore-gpu-blocklist</code> dans la barre d'adresse, choisissez « Enabled », puis relancez.</li>
<li>Mettez aussi à jour le navigateur et le pilote de la carte graphique. Sur un ordinateur professionnel, le service informatique bloque parfois la 3D.</li></ul>`;

function start() {
  loadKeymaps();
  const app = new App();
  const screens = new Screens(app);
  installLan(screens);
  screens.showTitle();
  // The loading screen goes away once the first frames are drawn.
  const hideBoot = () => {
    if (window.__ready) document.getElementById('boot')?.remove();
    else requestAnimationFrame(hideBoot);
  };
  hideBoot();
  // Debug/test hooks (used by the automated browser smoke test).
  (window as unknown as Record<string, unknown>).__tofu = { app, screens };
}

const problem = webgl2Problem();
if (problem) {
  window.__bootFail?.("Votre navigateur n'affiche pas la 3D.", WEBGL_HELP, problem);
} else {
  try {
    start();
  } catch (e) {
    // three.js throws here when it cannot create its 3D context after all.
    const detail = e instanceof Error ? e.message : String(e);
    window.__bootFail?.("Le jeu n'a pas pu démarrer.", /webgl/i.test(detail) ? WEBGL_HELP : (window.__bootTips?.() ?? ''), detail);
    console.error(e);
  }
}
