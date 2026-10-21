// Menus and game flow screens (French UI).
import type { App } from '../app';
import { sfx } from '../audio/sfx';
import { CHAOS_GOAL_BY_HUMANS, COUNTDOWN_TIME, DEFAULT_DURATION } from '../../shared/constants';
import type { GameConfig, GameState, PlayerSlot } from '../../shared/sim/types';
import { SECRET_DEFS, TASK_DEFS } from '../../shared/sim/rules';
import { CameraRig } from '../render/camera';
import { HUMAN_LOOKS } from '../render/characters';
import { LocalSession } from '../runtime/localSession';
import type { NetSession } from '../runtime/netSession';
import type { LocalPlayer } from '../runtime/session';
import {
  GamepadDevice, InputDevice, KEYMAPS, KeyMap, KeyboardDevice, KeymapName, TouchDevice, bindKey, keyLabel, listGamepads,
  resetKeymaps,
} from '../input/devices';
import { el, fmtTime, glyph } from './hud';
import { BTN_BARK, BTN_INTERACT, BTN_SIT, BTN_SPECIAL, BTN_SPRINT } from '../../shared/constants';

export const isTouch = () => matchMedia('(pointer: coarse)').matches || navigator.maxTouchPoints > 1;

interface Prefs {
  duration: number;
  difficulty: number;
  avatar: number;
  name: string;
  autoCam: boolean;
}

export function loadPrefs(): Prefs {
  const d: Prefs = { duration: DEFAULT_DURATION, difficulty: 1, avatar: 0, name: '', autoCam: false };
  try {
    return { ...d, ...JSON.parse(localStorage.getItem('tofu.prefs') ?? '{}') };
  } catch {
    return d;
  }
}

export function savePrefs(p: Prefs) {
  try {
    localStorage.setItem('tofu.prefs', JSON.stringify(p));
  } catch {
    /* ignore */
  }
}

/** Keyboard/gamepad navigation for menus (arrows + Enter / d-pad + A). */
class MenuNav {
  private prevPad: boolean[][] = [];
  constructor(private root: HTMLElement) {
    const loop = () => {
      this.poll();
      requestAnimationFrame(loop);
    };
    requestAnimationFrame(loop);
    window.addEventListener('keydown', (e) => {
      if (!this.active()) return;
      if ((e.target as HTMLElement).tagName === 'INPUT' && (e.target as HTMLInputElement).type === 'text') return;
      if (['ArrowDown', 'ArrowRight'].includes(e.code)) this.move(1);
      else if (['ArrowUp', 'ArrowLeft'].includes(e.code)) this.move(-1);
      else return;
      e.preventDefault();
    });
  }

  private active(): boolean {
    return !!this.root.querySelector('.screen') && !this.root.querySelector('.screen[data-padjoin]');
  }

  private focusables(): HTMLElement[] {
    const scr = this.root.querySelector('.screen:last-of-type');
    if (!scr) return [];
    return [...scr.querySelectorAll<HTMLElement>('button:not([disabled]), input, .choice')].filter((e) => e.offsetParent !== null);
  }

  move(d: number) {
    const f = this.focusables();
    if (!f.length) return;
    const i = f.indexOf(document.activeElement as HTMLElement);
    const n = f[(i + d + f.length) % f.length];
    n.focus();
    sfx.play('click', 0.5);
  }

  private poll() {
    if (!this.active()) return;
    const pads = listGamepads();
    pads.forEach((p) => {
      const prev = this.prevPad[p.index] ?? [];
      const b = (i: number) => !!p.buttons[i]?.pressed;
      const ax = p.axes[0] ?? 0;
      const ay = p.axes[1] ?? 0;
      const now = [b(0), b(1), b(12) || ay < -0.6, b(13) || ay > 0.6, b(14) || ax < -0.6, b(15) || ax > 0.6];
      if (now[2] && !prev[2]) this.move(-1);
      if ((now[3] && !prev[3]) || (now[5] && !prev[5])) this.move(1);
      if (now[4] && !prev[4]) this.move(-1);
      if (now[0] && !prev[0]) {
        const a = document.activeElement as HTMLElement | null;
        if (a && this.root.contains(a)) a.click();
        else this.focusables()[0]?.focus();
      }
      if (now[1] && !prev[1]) (this.root.querySelector('.screen:last-of-type [data-back]') as HTMLElement | null)?.click();
      this.prevPad[p.index] = now;
    });
  }
}

export class Screens {
  prefs = loadPrefs();
  private current: HTMLElement | null = null;
  private overlay: HTMLElement | null = null;
  private lastConfig: { cfg: GameConfig; locals: LocalPlayer[] } | null = null;
  private touchDevice: TouchDevice | null = null;
  private countdownEl: HTMLElement | null = null;
  private introEls: HTMLElement[] = [];
  /** Network screens are injected by the LAN module. */
  lan: { open(): void; leave(): void; rematch(rotate: boolean): void; toLobby(): void; isActive(): boolean; isHost(): boolean } | null = null;

  constructor(readonly app: App) {
    new MenuNav(app.uiRoot);
    app.hooks.onEnd = (S) => this.showEnd(S);
    app.hooks.onPauseRequest = () => this.togglePause();
    if (isTouch()) document.body.classList.add('touch');
    const rh = el('div', 'rotate-hint', '<div class="ph">📱</div>Tourne ton téléphone en mode paysage pour jouer !');
    document.body.appendChild(rh);
    const unlock = () => {
      sfx.unlock();
      sfx.startMusic();
    };
    window.addEventListener('pointerdown', unlock, { once: false });
    window.addEventListener('keydown', unlock, { once: false });
    const tick = () => {
      this.updateCountdown();
      requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  }

  show(node: HTMLElement, autofocus = true) {
    this.clear();
    this.current = node;
    this.app.uiRoot.appendChild(node);
    document.body.classList.remove('ingame');
    if (autofocus) setTimeout(() => (node.querySelector('button.primary, button') as HTMLElement | null)?.focus({ preventScroll: true }), 30);
  }

  clear() {
    this.current?.remove();
    this.current = null;
    this.overlay?.remove();
    this.overlay = null;
  }

  // ---------------------------------------------------------------- Title

  showTitle() {
    this.leaveGame();
    this.startAttract();
    const s = el('div', 'screen');
    const remote = !['localhost', '127.0.0.1', '::1', ''].includes(location.hostname);
    s.innerHTML = `
      <div class="logo"><img src="./favicon.svg" alt=""><div class="t1">TOFU !</div><div class="t2">QUI A FAIT ÇA ?</div></div>
      <div class="menu">
        ${remote ? '<button class="primary" data-a="lan"><span class="ico">📱</span><span>Rejoindre la partie<small>Partie en réseau local (Wi-Fi)</small></span></button>' : ''}
        <button class="${remote ? '' : 'primary'}" data-a="solo"><span class="ico">🐶</span><span>Jouer seul<small>Contre l'ordinateur</small></span></button>
        <button data-a="local"><span class="ico">🎮</span><span>Plusieurs joueurs sur ce PC<small>Écran partagé, 2 ou 3 joueurs</small></span></button>
        ${remote ? '' : '<button data-a="lan"><span class="ico">📱</span><span>Réseau local<small>Téléphones et autres PC sur le Wi-Fi</small></span></button>'}
        <div class="row" style="justify-content:stretch">
          <button data-a="howto" style="flex:1"><span class="ico">❓</span><span>Comment jouer</span></button>
          <button data-a="settings" style="flex:1"><span class="ico">⚙️</span><span>Réglages</span></button>
        </div>
      </div>
      <div class="hint">Un jeu de bêtises pour toute la famille · Clavier, manette ou écran tactile</div>`;
    s.addEventListener('click', (e) => {
      const b = (e.target as HTMLElement).closest('button');
      if (!b) return;
      sfx.play('click');
      const a = b.dataset.a;
      if (a === 'solo') this.showSolo();
      if (a === 'local') this.showLocal();
      if (a === 'lan') this.lan?.open();
      if (a === 'howto') this.showHowTo();
      if (a === 'settings') this.showSettings(() => this.showTitle());
    });
    this.show(s);
  }

  /** AI vs AI game running behind the title screen. */
  startAttract() {
    const players: PlayerSlot[] = [
      { role: 'tofu', name: 'Tofu', avatar: 0, ai: true },
      { role: 'human', name: 'Maman', avatar: 0, ai: true },
      { role: 'human', name: 'Léa', avatar: 2, ai: true },
    ];
    const sess = new LocalSession({ seed: Math.floor(Math.random() * 1e9), duration: 100000, players, noCountdown: true, difficulty: 1 }, []);
    sess.maxFrameDt = this.app.maxDt;
    this.app.start(sess, sess.game, true);
  }

  leaveGame() {
    this.lan?.leave();
    this.endSession();
  }

  /** Stops the running game view without leaving a network room. */
  endSession() {
    this.app.stop();
    this.touchDevice?.dispose();
    this.touchDevice = null;
    this.clearIntro();
    this.overlay?.remove();
    this.overlay = null;
  }

  // ---------------------------------------------------------------- Solo

  showSolo() {
    const p = this.prefs;
    let role: 'tofu' | 'human' = 'tofu';
    let humansAI = 1;
    let teammate = false;
    const s = el('div', 'screen dim');
    const render = () => {
      s.innerHTML = `
      <div class="panel">
        <h2>🐶 Jouer seul</h2>
        <div class="row">
          <div class="choice ${role === 'tofu' ? 'sel' : ''}" tabindex="0" data-role="tofu"><span class="em">🐶</span>Jouer Tofu<br><small>Fais un maximum de bêtises !</small></div>
          <div class="choice ${role === 'human' ? 'sel' : ''}" tabindex="0" data-role="human"><span class="em">🧹</span>Jouer un humain<br><small>Prépare la maison et surveille Tofu !</small></div>
        </div>
        <div class="opts">
          ${role === 'tofu' ? `<span>Humains (ordinateur)</span><div class="seg" data-k="humans">${[1, 2].map((n) => `<button class="${humansAI === n ? 'sel' : ''}" data-v="${n}">${n}</button>`).join('')}</div>` : `
          <span>Ton personnage</span><div class="seg" data-k="avatar">${HUMAN_LOOKS.slice(0, 4).map((l, i) => `<button class="${p.avatar === i ? 'sel' : ''}" data-v="${i}">${l.name}</button>`).join('')}</div>
          <span>Coéquipier</span><div class="seg" data-k="mate"><button class="${!teammate ? 'sel' : ''}" data-v="0">Seul</button><button class="${teammate ? 'sel' : ''}" data-v="1">+ 1 humain ordinateur</button></div>`}
          <span>Difficulté</span><div class="seg" data-k="diff">${['Facile', 'Normal', 'Difficile'].map((n, i) => `<button class="${p.difficulty === i ? 'sel' : ''}" data-v="${i}">${n}</button>`).join('')}</div>
          <span>Durée</span><div class="seg" data-k="dur">${[240, 360, 480].map((d) => `<button class="${p.duration === d ? 'sel' : ''}" data-v="${d}">${d / 60} min</button>`).join('')}</div>
        </div>
        <div class="foot">
          <button class="big" data-back>⬅ Retour</button>
          <button class="big primary" data-go>C'est parti ! ▶</button>
        </div>
      </div>`;
    };
    render();
    s.addEventListener('click', (e) => {
      const t = e.target as HTMLElement;
      const ch = t.closest('.choice') as HTMLElement | null;
      if (ch) {
        role = ch.dataset.role as 'tofu' | 'human';
        sfx.play('click');
        render();
        return;
      }
      const b = t.closest('button') as HTMLButtonElement | null;
      if (!b) return;
      sfx.play('click');
      const seg = b.closest('.seg') as HTMLElement | null;
      if (seg) {
        const v = Number(b.dataset.v);
        if (seg.dataset.k === 'humans') humansAI = v;
        if (seg.dataset.k === 'avatar') p.avatar = v;
        if (seg.dataset.k === 'mate') teammate = v === 1;
        if (seg.dataset.k === 'diff') p.difficulty = v;
        if (seg.dataset.k === 'dur') p.duration = v;
        savePrefs(p);
        render();
        return;
      }
      if (b.hasAttribute('data-back')) this.showTitle();
      if (b.hasAttribute('data-go')) {
        const players: PlayerSlot[] = [];
        if (role === 'tofu') {
          players.push({ role: 'tofu', name: 'Tofu', avatar: 0, ai: false });
          players.push({ role: 'human', name: 'Maman', avatar: 0, ai: true });
          if (humansAI === 2) players.push({ role: 'human', name: 'Papa', avatar: 1, ai: true });
        } else {
          players.push({ role: 'tofu', name: 'Tofu', avatar: 0, ai: true });
          players.push({ role: 'human', name: HUMAN_LOOKS[p.avatar].name, avatar: p.avatar, ai: false });
          if (teammate) players.push({ role: 'human', name: HUMAN_LOOKS[(p.avatar + 1) % 4].name, avatar: (p.avatar + 1) % 4, ai: true });
        }
        const myId = role === 'tofu' ? 0 : 1;
        const dev = this.primaryDevice(role);
        this.startLocal(
          { seed: Math.floor(Math.random() * 1e9), duration: p.duration, players, difficulty: p.difficulty },
          [{ slot: 0, charId: myId, device: dev, rig: this.newRig(), rect: { x: 0, y: 0, w: 1, h: 1 }, raw: null, name: 'Moi' }],
        );
      }
    });
    s.addEventListener('keydown', (e) => {
      const ch = (e.target as HTMLElement).closest?.('.choice') as HTMLElement | null;
      if (ch && (e.code === 'Enter' || e.code === 'Space')) ch.click();
    });
    this.show(s);
  }

  /** Best input device for a single local player. */
  primaryDevice(role: 'tofu' | 'human'): InputDevice {
    if (isTouch() && !listGamepads().length) {
      this.touchDevice?.dispose();
      this.touchDevice = new TouchDevice(this.app.hudRoot.parentElement!, role);
      return this.touchDevice;
    }
    const kb = new KeyboardDevice('kb-full', 'Clavier + souris', KEYMAPS.full, this.app.canvas);
    const pads = listGamepads();
    if (pads.length) return new MultiDevice([kb, new GamepadDevice('pad' + pads[0].index, 'Manette', pads[0].index)]);
    return new MultiDevice([kb, new LazyPad()]);
  }

  newRig(): CameraRig {
    const r = new CameraRig();
    r.autoFollow = this.prefs.autoCam;
    return r;
  }

  // ---------------------------------------------------------------- Local split screen

  showLocal() {
    interface Joined { dev: InputDevice; role: 'tofu' | 'human'; avatar: number; lx: number; ly: number }
    const joined: Joined[] = [];
    const kbLeft = new KeyboardDevice('kb-left', 'Clavier gauche', KEYMAPS.left);
    const kbRight = new KeyboardDevice('kb-right', 'Clavier droit', KEYMAPS.right);
    let fillAI = true;
    const s = el('div', 'screen dim');
    // Join keys and gamepads are handled here, not by the menu navigation.
    s.dataset.padjoin = '1';
    const has = (id: string) => joined.some((j) => j.dev.id === id);
    const render = () => {
      const slots = [0, 1, 2].map((i) => {
        const j = joined[i];
        if (!j) {
          return `<div class="slot"><h4>Joueur ${i + 1}</h4><p>Pour rejoindre, appuie sur :</p><p>
            ${has('kb-left') ? '' : `<kbd>${keyLabel(KEYMAPS.left.interact[0] ?? 'Space')}</kbd> clavier gauche (${['up', 'left', 'down', 'right'].map((k) => keyLabel(KEYMAPS.left[k as keyof KeyMap][0] ?? '')).join('')})<br>`}
            ${has('kb-right') ? '' : `<kbd>${keyLabel(KEYMAPS.right.interact[0] ?? 'Enter')}</kbd> clavier droit (flèches)<br>`}
            <kbd>A</kbd> sur une manette</p></div>`;
        }
        return `<div class="slot joined"><h4>Joueur ${i + 1} · ${j.dev.label}</h4>
          <div class="seg" data-i="${i}" data-k="role"><button class="${j.role === 'tofu' ? 'sel' : ''}" data-v="tofu">🐶 Tofu</button><button class="${j.role === 'human' ? 'sel' : ''}" data-v="human">🧑 Humain</button></div>
          ${j.role === 'human' ? `<div class="seg" data-i="${i}" data-k="avatar" style="margin-top:.5rem">${HUMAN_LOOKS.slice(0, 4).map((l, k) => `<button class="${j.avatar === k ? 'sel' : ''}" data-v="${k}">${l.name}</button>`).join('')}</div>` : ''}
          <p class="small">Gauche / droite : rôle${j.role === 'human' ? ' · haut / bas : personnage' : ''}</p>
          <p><button class="mini" data-leave="${i}">Quitter</button></p></div>`;
      }).join('');
      const tofus = joined.filter((j) => j.role === 'tofu').length;
      const err = tofus > 1 ? '<p class="err">Un seul joueur peut être Tofu !</p>' : '';
      s.innerHTML = `<div class="panel"><h2>🎮 Plusieurs joueurs sur ce PC</h2>
        <p>Chaque joueur appuie sur son bouton pour rejoindre (1 à 3 joueurs). L'écran se partage automatiquement.</p>
        <div class="slots">${slots}</div>${err}
        <div class="opts"><span>Rôles manquants</span><div class="seg" data-k="fill"><button class="${fillAI ? 'sel' : ''}" data-v="1">Complétés par l'ordinateur</button><button class="${!fillAI ? 'sel' : ''}" data-v="0">Non</button></div>
        <span>Durée</span><div class="seg" data-k="dur">${[240, 360, 480].map((d) => `<button class="${this.prefs.duration === d ? 'sel' : ''}" data-v="${d}">${d / 60} min</button>`).join('')}</div></div>
        <p class="small">Pour lancer : bouton « Jouer », ou la touche pause d'un joueur (${keyLabel('Escape')} · ⌫ · Start).</p>
        <div class="foot"><button class="big" data-back>⬅ Retour</button><button class="big primary" data-go ${joined.length < 1 || tofus > 1 ? 'disabled' : ''}>Jouer ▶</button></div></div>`;
    };
    render();
    /** Gives a human player a look nobody else uses. */
    const freeLook = (j: Joined) => {
      if (j.role !== 'human') return;
      const taken = new Set(joined.filter((o) => o !== j && o.role === 'human').map((o) => o.avatar));
      if (taken.has(j.avatar)) j.avatar = [0, 1, 2, 3].find((a) => !taken.has(a)) ?? j.avatar;
    };
    const join = (dev: InputDevice) => {
      if (joined.length >= 3 || has(dev.id)) return;
      const used = new Set(joined.map((j) => j.avatar));
      const avatar = [0, 1, 2, 3].find((a) => !used.has(a)) ?? 0;
      joined.push({ dev, role: joined.some((j) => j.role === 'tofu') ? 'human' : 'tofu', avatar, lx: 0, ly: 0 });
      sfx.play('pickup');
      render();
    };
    const close = () => {
      window.removeEventListener('keydown', onKey, true);
      if (this.app.hooks.onFrame === onFrame) this.app.hooks.onFrame = undefined;
    };
    // Space / Enter join instead of pressing the focused menu button.
    const onKey = (e: KeyboardEvent) => {
      if (!s.isConnected) {
        close();
        return;
      }
      const left = KEYMAPS.left.interact.includes(e.code);
      const right = KEYMAPS.right.interact.includes(e.code);
      if (!left && !right) return;
      e.preventDefault();
      (document.activeElement as HTMLElement | null)?.blur?.();
      if (!e.repeat) join(left ? kbLeft : kbRight);
    };
    window.addEventListener('keydown', onKey, true);
    // Gamepad A / B edges (a held button does not count until released).
    const padPrev = new Map<number, [boolean, boolean]>();
    for (const p of listGamepads()) padPrev.set(p.index, [!!p.buttons[0]?.pressed, !!p.buttons[1]?.pressed]);
    const onFrame = (dt: number) => {
      if (!s.isConnected) {
        close();
        return;
      }
      for (const p of listGamepads()) {
        const id = 'pad' + p.index;
        const a = !!p.buttons[0]?.pressed;
        const b = !!p.buttons[1]?.pressed;
        const [pa, pb] = padPrev.get(p.index) ?? [false, false];
        padPrev.set(p.index, [a, b]);
        if (a && !pa && !has(id)) {
          const dev = new GamepadDevice(id, `Manette ${p.index + 1}`, p.index);
          dev.poll(0);
          join(dev);
        }
        if (b && !pb) {
          const k = joined.findIndex((j) => j.dev.id === id);
          if (k >= 0) {
            joined.splice(k, 1);
            render();
          } else {
            close();
            this.showTitle();
            return;
          }
        }
      }
      // Joined players: left/right switches the role, up/down the look, pause starts.
      for (const j of joined) {
        const r = j.dev.poll(dt);
        const hx = r.mx > 0.6 ? 1 : r.mx < -0.6 ? -1 : 0;
        const hy = r.my > 0.6 ? 1 : r.my < -0.6 ? -1 : 0;
        if (hx && hx !== j.lx) {
          j.role = j.role === 'tofu' ? 'human' : 'tofu';
          freeLook(j);
          sfx.play('click');
          render();
        }
        if (hy && hy !== j.ly && j.role === 'human') {
          // Next look not taken by another player.
          const taken = new Set(joined.filter((o) => o !== j && o.role === 'human').map((o) => o.avatar));
          for (let k = 1; k <= 4; k++) {
            const a = (j.avatar + (hy > 0 ? 4 - k : k)) % 4;
            if (!taken.has(a)) {
              j.avatar = a;
              break;
            }
          }
          sfx.play('click');
          render();
        }
        j.lx = hx;
        j.ly = hy;
        if (r.pause) {
          go();
          return;
        }
      }
    };
    this.app.hooks.onFrame = onFrame;
    const go = () => {
      const tofus = joined.filter((j) => j.role === 'tofu').length;
      if (!joined.length || tofus > 1) return;
      close();
      const players: PlayerSlot[] = [];
      const locals: LocalPlayer[] = [];
      const tofuJ = joined.find((j) => j.role === 'tofu');
      players.push({ role: 'tofu', name: 'Tofu', avatar: 0, ai: !tofuJ });
      if (tofuJ) locals.push({ slot: joined.indexOf(tofuJ), charId: 0, device: tofuJ.dev, rig: this.newRig(), rect: { x: 0, y: 0, w: 1, h: 1 }, raw: null, name: 'Tofu' });
      const humansJ = joined.filter((j) => j.role === 'human');
      humansJ.forEach((j) => {
        const id = players.length;
        players.push({ role: 'human', name: HUMAN_LOOKS[j.avatar].name, avatar: j.avatar, ai: false });
        locals.push({ slot: joined.indexOf(j), charId: id, device: j.dev, rig: this.newRig(), rect: { x: 0, y: 0, w: 1, h: 1 }, raw: null, name: HUMAN_LOOKS[j.avatar].name });
      });
      if (fillAI && humansJ.length === 0) {
        players.push({ role: 'human', name: 'Maman', avatar: 0, ai: true });
        players.push({ role: 'human', name: 'Papa', avatar: 1, ai: true });
      } else if (fillAI && humansJ.length === 1 && joined.length === 1) {
        players.push({ role: 'human', name: 'Papa', avatar: (humansJ[0].avatar + 1) % 4, ai: true });
      }
      if (!players.some((p) => p.role === 'human')) players.push({ role: 'human', name: 'Maman', avatar: 0, ai: true });
      locals.sort((a, b) => a.slot - b.slot);
      locals.forEach((l, i) => (l.slot = i));
      this.startLocal({ seed: Math.floor(Math.random() * 1e9), duration: this.prefs.duration, players, difficulty: this.prefs.difficulty }, locals);
    };
    s.addEventListener('click', (e) => {
      const b = (e.target as HTMLElement).closest('button') as HTMLButtonElement | null;
      if (!b) return;
      sfx.play('click');
      const seg = b.closest('.seg') as HTMLElement | null;
      if (seg) {
        const k = seg.dataset.k;
        if (k === 'fill') fillAI = b.dataset.v === '1';
        else if (k === 'dur') {
          this.prefs.duration = Number(b.dataset.v);
          savePrefs(this.prefs);
        } else {
          const j = joined[Number(seg.dataset.i)];
          if (k === 'role') {
            j.role = b.dataset.v as 'tofu' | 'human';
            freeLook(j);
          }
          if (k === 'avatar') {
            // Taking a look already used swaps it with that player.
            const v = Number(b.dataset.v);
            const other = joined.find((o) => o !== j && o.role === 'human' && o.avatar === v);
            if (other) other.avatar = j.avatar;
            j.avatar = v;
          }
        }
        render();
        return;
      }
      if (b.dataset.leave !== undefined) {
        joined.splice(Number(b.dataset.leave), 1);
        render();
        return;
      }
      if (b.hasAttribute('data-back')) {
        close();
        this.showTitle();
      }
      if (b.hasAttribute('data-go')) go();
    });
    this.show(s, false);
  }

  // ---------------------------------------------------------------- Game start / flow

  startLocal(cfg: GameConfig, locals: LocalPlayer[]) {
    this.clear();
    this.lastConfig = { cfg, locals };
    const sess = new LocalSession(cfg, locals);
    sess.maxFrameDt = this.app.maxDt;
    this.app.start(sess, sess.game);
    document.body.classList.add('ingame');
    this.showIntro();
  }

  /** Starts a network match (state mirrored from the LAN server). */
  startNet(sess: NetSession) {
    this.clear();
    this.clearIntro();
    this.app.start(sess, sess.helper);
    document.body.classList.add('ingame');
    const S = sess.state;
    if (S.phase === 'countdown' && S.countdown > COUNTDOWN_TIME + 0.5) this.showIntro(S.countdown - COUNTDOWN_TIME);
    else if (this.touchDevice) this.app.hudRoot.parentElement!.appendChild(this.touchDevice.el);
  }

  /** Role cards before the 3-2-1 countdown. */
  showIntro(duration = 4.2) {
    const s = this.app.session;
    if (!s) return;
    this.clearIntro();
    this.app.intro = duration;
    const S = s.state;
    s.locals.forEach((lp, i) => {
      const me = S.chars[lp.charId];
      const card = el('div', 'intro-card');
      const dev = lp.device;
      if (lp.spectator) {
        card.innerHTML = '<div class="em">👀</div><h2>Tu regardes cette manche</h2><p>Tous les rôles sont pris : tu joueras à la prochaine !</p>';
        (this.app.hudFor(i)?.el ?? this.app.hudRoot).appendChild(card);
        this.introEls.push(card);
        return;
      }
      const ctr = `<p style="font-size:.9rem;opacity:.85">Action <kbd>${glyph(dev, BTN_INTERACT)}</kbd> · Courir <kbd>${glyph(dev, BTN_SPRINT)}</kbd> · ${me.role === 'tofu' ? 'Zoomies' : 'Friandise'} <kbd>${glyph(dev, BTN_SPECIAL)}</kbd> · ${me.role === 'tofu' ? 'Aboyer' : 'Appeler'} <kbd>${glyph(dev, BTN_BARK)}</kbd>${me.role === 'tofu' ? ` · Assis <kbd>${glyph(dev, BTN_SIT)}</kbd>` : ''}</p>`;
      if (me.role === 'tofu') {
        card.innerHTML = `<div class="em">🐶</div><h2>Tu es TOFU !</h2><p>Fais <b>${S.chaosGoal} points de bêtises</b> ou tiens jusqu'à la fin du temps !</p>
          <p><b>Tes défis secrets :</b></p><ul>${S.secrets.map((x) => `<li>${SECRET_DEFS.find((d) => d.id === x.id)!.icon} ${SECRET_DEFS.find((d) => d.id === x.id)!.text}</li>`).join('')}</ul>${ctr}`;
      } else {
        card.innerHTML = `<div class="em">🧹</div><h2>${me.name}, prépare la maison !</h2><p>Les invités arrivent. Finissez toutes les tâches et gardez la maison propre (${S.cleanGoal} %).</p>
          <ul>${S.tasks.map((t) => `<li>${TASK_DEFS[t.kind].icon} ${TASK_DEFS[t.kind].title}</li>`).join('')}</ul><p>⚠️ Surveillez Tofu !</p>${ctr}`;
      }
      const vp = this.app.hudFor(i)?.el;
      (vp ?? this.app.hudRoot).appendChild(card);
      this.introEls.push(card);
    });
    setTimeout(() => this.clearIntro(), duration * 1000);
    if (this.touchDevice) {
      this.app.hudRoot.parentElement!.appendChild(this.touchDevice.el);
    }
  }

  private clearIntro() {
    for (const e of this.introEls) e.remove();
    this.introEls = [];
  }

  private updateCountdown() {
    const s = this.app.session;
    const show = !!s && s.state.phase === 'countdown' && this.app.intro <= 0;
    if (!show) {
      this.countdownEl?.remove();
      this.countdownEl = null;
      return;
    }
    const n = Math.ceil(s!.state.countdown);
    const txt = n > 0 ? String(n) : 'Partez !';
    if (!this.countdownEl) {
      this.countdownEl = el('div', 'countdown');
      this.app.hudRoot.appendChild(this.countdownEl);
    }
    if (this.countdownEl.textContent !== txt) {
      this.countdownEl.textContent = txt;
      this.countdownEl.style.animation = 'none';
      void this.countdownEl.offsetWidth;
      this.countdownEl.style.animation = '';
    }
  }

  togglePause() {
    const s = this.app.session;
    if (!s || s.state.phase === 'end') return;
    if (this.overlay) {
      this.overlay.remove();
      this.overlay = null;
      s.paused = false;
      return;
    }
    // A network match keeps running; the player just stands still.
    s.paused = true;
    const o = el('div', 'screen dim');
    o.innerHTML = `<div class="panel" style="max-width:420px"><h2>⏸ Pause</h2>${s.kind === 'net' ? '<p>La partie continue pour les autres joueurs.</p>' : ''}
      <div class="menu" style="width:100%">
        <button class="primary" data-a="resume"><span class="ico">▶</span>Reprendre</button>
        ${s.kind === 'local' ? '<button data-a="restart"><span class="ico">🔄</span>Recommencer</button>' : ''}
        <button data-a="settings"><span class="ico">⚙️</span>Réglages</button>
        <button data-a="quit" data-back><span class="ico">🚪</span>Quitter la partie</button>
      </div></div>`;
    o.addEventListener('click', (e) => {
      const b = (e.target as HTMLElement).closest('button');
      if (!b) return;
      sfx.play('click');
      const a = b.dataset.a;
      if (a === 'resume') this.togglePause();
      if (a === 'restart' && this.lastConfig) {
        this.overlay?.remove();
        this.overlay = null;
        this.startLocal({ ...this.lastConfig.cfg, seed: Math.floor(Math.random() * 1e9) }, this.lastConfig.locals);
      }
      if (a === 'settings') {
        this.overlay?.remove();
        this.overlay = null;
        this.showSettings(() => {
          this.clear();
          s.paused = false;
        }, true);
      }
      if (a === 'quit') this.showTitle();
    });
    this.overlay = o;
    this.app.uiRoot.appendChild(o);
    setTimeout(() => (o.querySelector('button') as HTMLElement)?.focus({ preventScroll: true }), 30);
  }

  // ---------------------------------------------------------------- End screen

  showEnd(S: GameState) {
    if (!this.app.session) return;
    const isNet = this.app.session.kind === 'net';
    const st = S.stats;
    const tofuWon = S.winner === 'tofu';
    const reason = S.endReason === 'chaos' ? 'Trop de bêtises dans la maison ! 😈'
      : S.endReason === 'time' ? 'Le temps est écoulé et la maison n\'est pas prête…'
        : S.endReason === 'guests' ? 'La maison est prête : les invités sont ravis ! 🎉'
          : S.endReason === 'abandon' ? 'Partie interrompue.' : '';
    const humans = S.chars.filter((c) => c.role === 'human');
    const awards: string[] = [];
    const best = (key: string) => {
      let b: { name: string; n: number } | null = null;
      for (const h of humans) {
        const n = S.charStats[h.id]?.[key] ?? 0;
        if (n > 0 && (!b || n > b.n)) b = { name: h.name, n };
      }
      return b;
    };
    const cl = best('cleaned');
    if (cl) awards.push(`🧽 As du ménage : ${cl.name} (${cl.n})`);
    const rc = best('recovered');
    if (rc) awards.push(`🙌 Champion de la récup' : ${rc.name} (${rc.n})`);
    const sl = best('slips');
    if (sl) awards.push(`🍌 Roi de la glissade : ${sl.name} (${sl.n})`);
    if (st.laundryStolen >= 3) awards.push('🧦 Tofu, voleur de chaussettes');
    if (st.catChase > 8) awards.push('🐈 Tofu, chasseur de chat');
    if (st.mudPrints > 30) awards.push('🐾 Tofu, artiste de la boue');
    if ((st.paperUnrolled ?? 0) >= 20) awards.push('🧻 Tofu, champion du papier toilette');
    const o = el('div', 'screen dim');
    o.innerHTML = `<div class="end-banner ${tofuWon ? '' : 'humans'}">${tofuWon ? '😈 TOFU A GAGNÉ\u00a0!' : '🎉 LES HUMAINS ONT GAGNÉ\u00a0!'}</div>
      <div class="panel">
        <p style="text-align:center;font-size:1.2rem;font-weight:600">${reason}</p>
        <p style="text-align:center">Bêtises : <b>${Math.floor(S.chaos)} / ${S.chaosGoal}</b> · Propreté : <b>${Math.round(S.cleanliness)} %</b> · Tâches : <b>${S.tasks.filter((t) => t.done).length} / ${S.tasks.length}</b> · Temps : <b>${fmtTime(S.time)}</b></p>
        <div class="stats">
          <div>🧦 Vêtements volés <b>${st.laundryStolen}</b></div>
          <div>🎁 Objets chipés <b>${st.itemsStolen}</b></div>
          <div>💥 Objets renversés <b>${st.knocks}</b></div>
          <div>🗑️ Poubelles renversées <b>${st.binsTipped}</b></div>
          <div>🐾 Traces de boue <b>${st.mudPrints}</b></div>
          <div>🐈 Chat poursuivi <b>${Math.round(st.catChase)} s</b></div>
          <div>🗯️ Aboiements <b>${st.barks}</b></div>
          <div>😋 Choses mangées <b>${st.eaten}</b></div>
          <div>🌀 Zoomies <b>${st.zoomies}</b></div>
          <div>🧹 Désordres nettoyés <b>${st.messesCleaned}</b></div>
          <div>🙌 Objets récupérés <b>${st.recovered}</b></div>
          <div>🦴 Friandises lancées <b>${st.treatsThrown}</b></div>
          <div>🍌 Glissades <b>${st.slips}</b></div>
          <div>🚪 Portes fermées <b>${st.doorsClosed}</b></div>
          <div>🏃 Distance de Tofu <b>${Math.round(st.tofuDistance)} m</b></div>
          <div>✅ Tâches réussies <b>${st.tasksDone}</b></div>
          <div>🧻 Papier déroulé <b>${st.paperUnrolled ?? 0}</b></div>
        </div>
        ${awards.length ? `<div class="awards">${awards.map((a) => `<span class="award">${a}</span>`).join('')}</div>` : ''}
        ${isNet ? `<div class="foot">
          <button class="big" data-a="menu" data-back>🚪 Quitter</button>
          <div class="row">
            <button class="big" data-a="lobby">📋 Salon</button>
            <button class="big host-only" data-a="rotate">🔁 Revanche (changer Tofu)</button>
            <button class="big primary host-only" data-a="again">🔄 Revanche</button>
            <span class="guest-only wait-host">⏳ L'hôte 👑 choisit la suite…</span>
          </div>
        </div>` : `<div class="foot">
          <button class="big" data-a="menu" data-back>🏠 Menu</button>
          <div class="row">
            <button class="big" data-a="rotate">🔁 Revanche (changer Tofu)</button>
            <button class="big primary" data-a="again">🔄 Revanche</button>
          </div>
        </div>`}
      </div>`;
    o.addEventListener('click', (e) => {
      const b = (e.target as HTMLElement).closest('button');
      if (!b) return;
      sfx.play('click');
      const a = b.dataset.a;
      if (a === 'menu') this.showTitle();
      if (a === 'lobby') {
        this.clear();
        this.lan?.toLobby();
        return;
      }
      if (a === 'again' || a === 'rotate') {
        if (isNet) {
          this.clear();
          this.lan?.rematch(a === 'rotate');
          return;
        }
        const sess = this.app.session as LocalSession;
        sess.rematch(a === 'rotate');
        this.clear();
        this.app.rebuildView(sess.game);
        this.showIntro();
      }
    });
    this.clear();
    this.current = o;
    this.app.uiRoot.appendChild(o);
    setTimeout(() => (o.querySelector('button.primary') as HTMLElement)?.focus({ preventScroll: true }), 30);
  }

  // ---------------------------------------------------------------- How to play / settings

  showHowTo() {
    const s = el('div', 'screen dim');
    const k = (c: string) => `<kbd>${keyLabel(c)}</kbd>`;
    const f = KEYMAPS.full;
    const r = KEYMAPS.right;
    /** First key of an action (the keyboard can be remapped in the settings). */
    const ks = (codes: string[]) => (codes.length ? k(codes[0]) : 'aucune');
    const move = (m: KeyMap) => [m.up, m.left, m.down, m.right].map(ks).join('');
    s.innerHTML = `<div class="panel">
      <h2>❓ Comment jouer</h2>
      <div class="cols">
        <div><h3>🐶 Tofu, le labrador</h3>
          <p>Remplis la barre de <b>bêtises</b> (${CHAOS_GOAL_BY_HUMANS[1]} points, ${CHAOS_GOAL_BY_HUMANS[2]} contre deux humains) ou empêche les humains de finir avant la fin du temps.</p>
          <p>Vole des chaussettes et cache-les dans ton panier, renverse les pots, poursuis le chat, roule-toi dans la boue puis cours dans la maison, renverse les poubelles, mange le goûter, déroule le papier toilette, allume l'aspirateur robot… Tu as 3 <b>défis secrets</b> qui rapportent gros !</p>
          <p>Les bêtises variées remplissent les <b>zoomies</b> : un sprint fou qui renverse tout.</p>
          <p>Tu passes par la chatière et par le trou de la haie, et sous les tables. Les portes fermées se poussent (maintenir Action).</p></div>
        <div><h3>🧹 Les humains</h3>
          <p>Finissez toutes les <b>tâches</b> de la liste et gardez la maison <b>propre</b> (barre verte au-dessus du trait) : les invités arrivent alors !</p>
          <p>Rattrapez Tofu pour <b>reprendre</b> ce qu'il porte, essuyez ses pattes, nettoyez les désordres (maintenir Action).</p>
          <p>Lancez une <b>friandise</b> : Tofu ne résiste pas et lâche tout. Fermez les portes pour le ralentir. Attention : en courant, on peut glisser ou renverser des choses !</p>
          <p>L'<b>aspirateur robot</b> du salon aspire la boue et le papier… mais bouscule tout sur son passage. On l'allume et on l'éteint avec Action.</p></div>
      </div>
      <h3>🎮 Commandes</h3>
      <table class="keys">
        <tr><td></td><td><b>Clavier</b></td><td><b>Clavier droit</b></td><td><b>Manette</b></td></tr>
        <tr><td>Bouger</td><td>${move(f)}${f.up.includes('ArrowUp') ? ' ou flèches' : ''}</td><td>${move(r)}</td><td>Stick gauche</td></tr>
        <tr><td>Caméra</td><td>Souris (glisser), ${ks(f.camLeft)} ${ks(f.camRight)}, molette</td><td>${ks(r.camLeft)} ${ks(r.camRight)}</td><td>Stick droit, LB/RB</td></tr>
        <tr><td>Action</td><td>${ks(f.interact)}</td><td>${ks(r.interact)}</td><td>A</td></tr>
        <tr><td>Courir</td><td>${ks(f.sprint)}</td><td>${ks(r.sprint)}</td><td>RT / LT</td></tr>
        <tr><td>Zoomies / Friandise</td><td>${ks(f.special)}</td><td>${ks(r.special)}</td><td>X</td></tr>
        <tr><td>Aboyer / Appeler</td><td>${ks(f.bark)}</td><td>${ks(r.bark)}</td><td>B</td></tr>
        <tr><td>S'asseoir (Tofu)</td><td>${ks(f.sit)}</td><td>${ks(r.sit)}</td><td>Y</td></tr>
        <tr><td>Vue du dessus</td><td>${ks(f.tactical)}</td><td>${ks(r.tactical)}</td><td>Select</td></tr>
        <tr><td>Pause</td><td>${ks(f.pause)}</td><td>${ks(r.pause)}</td><td>Start</td></tr>
      </table>
      <p>📱 Sur téléphone : joystick à gauche, glisser à droite pour tourner la caméra, gros boutons à droite.</p>
      <div class="foot"><button class="big" data-back>⬅ Retour</button></div></div>`;
    s.querySelector('[data-back]')!.addEventListener('click', () => this.showTitle());
    this.show(s);
  }

  showSettings(onBack: () => void, inGame = false) {
    const s = el('div', 'screen dim');
    const a = sfx.settings;
    const q = this.app.gr.quality;
    s.innerHTML = `<div class="panel" style="max-width:560px"><h2>⚙️ Réglages</h2>
      <div class="opts">
        <span>Volume général</span><input type="range" min="0" max="1" step="0.05" value="${a.master}" data-k="master">
        <span>Effets sonores</span><input type="range" min="0" max="1" step="0.05" value="${a.sfx}" data-k="sfx">
        <span>Musique</span><input type="range" min="0" max="1" step="0.05" value="${a.music}" data-k="music">
        <span>Son</span><div class="seg" data-k="mute"><button class="${!a.muted ? 'sel' : ''}" data-v="0">Activé</button><button class="${a.muted ? 'sel' : ''}" data-v="1">Coupé</button></div>
        <span>Graphismes</span><div class="seg" data-k="quality">${[['high', 'Beaux'], ['medium', 'Moyens'], ['low', 'Rapides']].map(([v, n]) => `<button class="${q === v ? 'sel' : ''}" data-v="${v}">${n}</button>`).join('')}</div>
        <span>Caméra auto</span><div class="seg" data-k="autocam"><button class="${!this.prefs.autoCam ? 'sel' : ''}" data-v="0">Non</button><button class="${this.prefs.autoCam ? 'sel' : ''}" data-v="1">Suit le personnage</button></div>
        ${isTouch() ? '' : '<span>Clavier</span><div class="seg" data-k="keys"><button data-v="1">⌨️ Changer les touches</button></div>'}
        <span>Astuces</span><div class="seg" data-k="tips"><button data-v="reset">Revoir les astuces</button></div>
        <span>Plein écran</span><div class="seg" data-k="fs"><button data-v="1">Basculer</button></div>
      </div>
      <p style="font-size:.85rem;opacity:.8">Les graphismes « Rapides » conviennent aux téléphones et aux vieux PC (rechargement de la page nécessaire).</p>
      <div class="foot"><button class="big primary" data-back>✔ OK</button></div></div>`;
    s.addEventListener('input', (e) => {
      const t = e.target as HTMLInputElement;
      const k = t.dataset.k as 'master' | 'sfx' | 'music';
      if (k) {
        a[k] = Number(t.value);
        sfx.apply();
      }
    });
    s.addEventListener('click', (e) => {
      const b = (e.target as HTMLElement).closest('button') as HTMLButtonElement | null;
      if (!b) return;
      sfx.play('click');
      const seg = b.closest('.seg') as HTMLElement | null;
      if (seg) {
        const k = seg.dataset.k;
        if (k === 'mute') {
          a.muted = b.dataset.v === '1';
          sfx.apply();
        }
        if (k === 'quality') {
          try {
            localStorage.setItem('tofu.quality', b.dataset.v!);
          } catch {
            /* ignore */
          }
          if (!inGame) location.reload();
        }
        if (k === 'autocam') {
          this.prefs.autoCam = b.dataset.v === '1';
          savePrefs(this.prefs);
          this.app.session?.locals.forEach((l) => (l.rig.autoFollow = this.prefs.autoCam));
        }
        if (k === 'keys') {
          this.showKeys(() => this.showSettings(onBack, inGame));
          return;
        }
        if (k === 'tips') {
          try {
            localStorage.removeItem('tofu.tips');
          } catch {
            /* ignore */
          }
          b.textContent = 'OK !';
          return;
        }
        if (k === 'fs') {
          if (document.fullscreenElement) void document.exitFullscreen();
          else void document.documentElement.requestFullscreen?.().catch(() => undefined);
          return;
        }
        this.showSettings(onBack, inGame);
        return;
      }
      if (b.hasAttribute('data-back')) onBack();
    });
    this.show(s);
  }

  /** Keyboard remapping for the three keyboard layouts (saved in this browser). */
  showKeys(onBack: () => void, layout: KeymapName = 'full') {
    const ACTIONS: [keyof KeyMap, string][] = [
      ['up', 'Avancer'], ['down', 'Reculer'], ['left', 'Aller à gauche'], ['right', 'Aller à droite'],
      ['interact', 'Action'], ['sprint', 'Courir'], ['special', 'Zoomies / Friandise'], ['bark', 'Aboyer / Appeler'],
      ['sit', "S'asseoir (Tofu)"], ['camLeft', 'Tourner la caméra à gauche'], ['camRight', 'Tourner la caméra à droite'],
      ['tactical', 'Vue du dessus'], ['pause', 'Pause'],
    ];
    const LAYOUTS: [KeymapName, string][] = [['full', 'Un seul joueur'], ['left', 'Clavier gauche'], ['right', 'Clavier droit']];
    let waiting: keyof KeyMap | null = null;
    const s = el('div', 'screen dim');
    // Captures the next key while waiting; the menu navigation stays off meanwhile.
    s.dataset.padjoin = '1';
    const render = () => {
      const m = KEYMAPS[layout];
      s.innerHTML = `<div class="panel" style="max-width:640px"><h2>⌨️ Touches du clavier</h2>
        <div class="seg" data-k="layout">${LAYOUTS.map(([v, n]) => `<button class="${layout === v ? 'sel' : ''}" data-v="${v}">${n}</button>`).join('')}</div>
        <table class="keys remap">${ACTIONS.map(([k, label]) => `<tr><td>${label}</td><td>${waiting === k
          ? '<b>Appuie sur une touche…</b> <small>(Échap : annuler)</small>'
          : m[k].length ? m[k].map((c) => `<kbd>${keyLabel(c)}</kbd>`).join(' ') : '<em>aucune</em>'}</td>
          <td><button class="mini" data-bind="${k}">Changer</button></td></tr>`).join('')}</table>
        <p class="small">« Clavier gauche » et « Clavier droit » servent quand deux joueurs partagent le même clavier. Une touche ne peut faire qu'une seule action par disposition.</p>
        <div class="foot"><button class="big" data-reset>↺ Touches d'origine</button><button class="big primary" data-back>✔ OK</button></div></div>`;
    };
    const close = () => window.removeEventListener('keydown', onKey, true);
    const onKey = (e: KeyboardEvent) => {
      if (!s.isConnected) {
        close();
        return;
      }
      if (!waiting) return;
      e.preventDefault();
      e.stopPropagation();
      if (e.code !== 'Escape' && e.code) bindKey(layout, waiting, e.code);
      waiting = null;
      sfx.play('click');
      render();
    };
    window.addEventListener('keydown', onKey, true);
    s.addEventListener('click', (e) => {
      const b = (e.target as HTMLElement).closest('button') as HTMLButtonElement | null;
      if (!b) return;
      sfx.play('click');
      if (b.dataset.bind) {
        waiting = b.dataset.bind as keyof KeyMap;
        b.blur();
        render();
        return;
      }
      const seg = b.closest('.seg') as HTMLElement | null;
      if (seg?.dataset.k === 'layout') {
        layout = b.dataset.v as KeymapName;
        waiting = null;
        render();
        return;
      }
      if (b.hasAttribute('data-reset')) {
        resetKeymaps();
        render();
        return;
      }
      if (b.hasAttribute('data-back')) {
        close();
        onBack();
      }
    });
    render();
    this.show(s, false);
  }
}

/** Combines several devices (e.g. keyboard + any gamepad) into one. */
export class MultiDevice implements InputDevice {
  readonly kind: InputDevice['kind'];
  readonly id: string;
  readonly label: string;
  constructor(readonly devs: InputDevice[]) {
    this.kind = devs[0].kind;
    this.id = devs[0].id;
    this.label = devs[0].label;
  }
  private lastKind: InputDevice['kind'] | null = null;
  poll(dt: number) {
    const rs = this.devs.map((d) => d.poll(dt));
    const r = { ...rs[0] };
    for (let i = 1; i < rs.length; i++) {
      const o = rs[i];
      if (Math.hypot(o.mx, o.my) > Math.hypot(r.mx, r.my)) {
        r.mx = o.mx;
        r.my = o.my;
      }
      if (o.buttons || Math.hypot(o.mx, o.my) > 0.3) this.lastKind = this.devs[i].kind;
      r.buttons |= o.buttons;
      r.yaw += o.yaw;
      r.pitch += o.pitch;
      r.zoom += o.zoom;
      r.pause = r.pause || o.pause;
      r.tactical = r.tactical || o.tactical;
    }
    if (rs[0].buttons || Math.hypot(rs[0].mx, rs[0].my) > 0.3) this.lastKind = this.devs[0].kind;
    return r;
  }
  /** Kind of the device used most recently (for button glyphs). */
  get activeKind() {
    return this.lastKind ?? this.kind;
  }
  anyPressed() {
    return this.devs.some((d) => d.anyPressed());
  }
}

/** Gamepad that may be plugged in later (the nth connected pad). */
export class LazyPad implements InputDevice {
  readonly kind = 'gamepad' as const;
  readonly id: string;
  readonly label = 'Manette';
  private dev: GamepadDevice | null = null;
  constructor(private nth = 0) {
    this.id = `pad-any-${nth}`;
  }
  poll(dt: number) {
    if (!this.dev || !this.dev.connected) {
      const p = listGamepads()[this.nth];
      this.dev = p ? new GamepadDevice('pad' + p.index, 'Manette', p.index) : null;
    }
    return this.dev ? this.dev.poll(dt) : { mx: 0, my: 0, yaw: 0, pitch: 0, zoom: 0, buttons: 0, pause: false, tactical: false };
  }
  anyPressed() {
    return this.dev?.anyPressed() ?? false;
  }
}
