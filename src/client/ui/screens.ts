// Menus and game flow screens (French UI).
import type { App } from '../app';
import { sfx } from '../audio/sfx';
import { DEFAULT_DURATION } from '../../shared/constants';
import type { GameConfig, GameState, PlayerSlot } from '../../shared/sim/types';
import { SECRET_DEFS, TASK_DEFS } from '../../shared/sim/rules';
import { CameraRig } from '../render/camera';
import { HUMAN_LOOKS } from '../render/characters';
import { LocalSession } from '../runtime/localSession';
import type { LocalPlayer } from '../runtime/session';
import {
  GamepadDevice, InputDevice, KEYMAPS, KeyboardDevice, TouchDevice, keyDown, keyLabel, keyPressed, listGamepads,
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
      if (['ArrowDown', 'ArrowRight'].includes(e.code)) this.move(1);
      else if (['ArrowUp', 'ArrowLeft'].includes(e.code)) this.move(-1);
      else return;
      e.preventDefault();
    });
  }

  private active(): boolean {
    return !!this.root.querySelector('.screen');
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
  lan: { open(): void; leave(): void; rematch(rotate: boolean): void; isActive(): boolean } | null = null;

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

  private show(node: HTMLElement) {
    this.clear();
    this.current = node;
    this.app.uiRoot.appendChild(node);
    document.body.classList.remove('ingame');
    setTimeout(() => (node.querySelector('button.primary, button') as HTMLElement | null)?.focus(), 30);
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
    this.app.start(sess, sess.game, true);
  }

  leaveGame() {
    this.lan?.leave();
    this.app.stop();
    this.touchDevice?.dispose();
    this.touchDevice = null;
    this.clearIntro();
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
    interface Joined { dev: InputDevice; role: 'tofu' | 'human'; avatar: number }
    const joined: Joined[] = [];
    const candidates = new Map<string, InputDevice>();
    candidates.set('kb-left', new KeyboardDevice('kb-left', 'Clavier (gauche)', KEYMAPS.left));
    candidates.set('kb-right', new KeyboardDevice('kb-right', 'Clavier (droite)', KEYMAPS.right));
    let fillAI = true;
    const s = el('div', 'screen dim');
    const render = () => {
      const slots = [0, 1, 2].map((i) => {
        const j = joined[i];
        if (!j) {
          return `<div class="slot"><h4>Joueur ${i + 1}</h4><p>Pour rejoindre :<br><kbd>${keyLabel('Space')}</kbd> clavier gauche (${keyLabel('KeyW')}${keyLabel('KeyA')}${keyLabel('KeyS')}${keyLabel('KeyD')})<br><kbd>Entrée</kbd> clavier droit (flèches)<br><kbd>A</kbd> sur une manette</p></div>`;
        }
        return `<div class="slot joined"><h4>Joueur ${i + 1} · ${j.dev.label}</h4>
          <div class="seg" data-i="${i}" data-k="role"><button class="${j.role === 'tofu' ? 'sel' : ''}" data-v="tofu">🐶 Tofu</button><button class="${j.role === 'human' ? 'sel' : ''}" data-v="human">🧑 Humain</button></div>
          ${j.role === 'human' ? `<div class="seg" data-i="${i}" data-k="avatar" style="margin-top:.5rem">${HUMAN_LOOKS.slice(0, 4).map((l, k) => `<button class="${j.avatar === k ? 'sel' : ''}" data-v="${k}">${l.name}</button>`).join('')}</div>` : ''}
          <p><button class="big" data-leave="${i}" style="font-size:.9rem;padding:.3rem .6rem">Quitter</button></p></div>`;
      }).join('');
      const tofus = joined.filter((j) => j.role === 'tofu').length;
      const err = tofus > 1 ? '<p class="err">Un seul joueur peut être Tofu !</p>' : '';
      s.innerHTML = `<div class="panel"><h2>🎮 Plusieurs joueurs sur ce PC</h2>
        <p>Chaque joueur appuie sur son bouton pour rejoindre (2 ou 3 joueurs). L'écran se partage automatiquement.</p>
        <div class="slots">${slots}</div>${err}
        <div class="opts"><span>Rôles manquants</span><div class="seg" data-k="fill"><button class="${fillAI ? 'sel' : ''}" data-v="1">Complétés par l'ordinateur</button><button class="${!fillAI ? 'sel' : ''}" data-v="0">Non</button></div>
        <span>Durée</span><div class="seg" data-k="dur">${[240, 360, 480].map((d) => `<button class="${this.prefs.duration === d ? 'sel' : ''}" data-v="${d}">${d / 60} min</button>`).join('')}</div></div>
        <div class="foot"><button class="big" data-back>⬅ Retour</button><button class="big primary" data-go ${joined.length < 1 || tofus > 1 ? 'disabled' : ''}>Jouer ▶</button></div></div>`;
    };
    render();
    let alive = true;
    const pollJoin = () => {
      if (!alive) return;
      if (joined.length < 3) {
        // Keyboard halves.
        if (keyPressed('Space') && !joined.some((j) => j.dev.id === 'kb-left') && !(document.activeElement?.tagName === 'BUTTON' && !keyDown('KeyW'))) {
          joined.push({ dev: candidates.get('kb-left')!, role: joined.some((j) => j.role === 'tofu') ? 'human' : 'tofu', avatar: joined.length % 4 });
          sfx.play('pickup');
          render();
        }
        if ((keyPressed('Enter') || keyPressed('NumpadEnter')) && !joined.some((j) => j.dev.id === 'kb-right') && document.activeElement?.tagName !== 'BUTTON') {
          joined.push({ dev: candidates.get('kb-right')!, role: joined.some((j) => j.role === 'tofu') ? 'human' : 'tofu', avatar: joined.length % 4 });
          sfx.play('pickup');
          render();
        }
        for (const p of listGamepads()) {
          const id = 'pad' + p.index;
          if (joined.some((j) => j.dev.id === id)) continue;
          if (p.buttons[0]?.pressed) {
            const dev = new GamepadDevice(id, `Manette ${p.index + 1}`, p.index);
            dev.poll(0);
            joined.push({ dev, role: joined.some((j) => j.role === 'tofu') ? 'human' : 'tofu', avatar: joined.length % 4 });
            sfx.play('pickup');
            render();
          }
        }
      }
      requestAnimationFrame(pollJoin);
    };
    requestAnimationFrame(pollJoin);
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
          if (k === 'role') j.role = b.dataset.v as 'tofu' | 'human';
          if (k === 'avatar') j.avatar = Number(b.dataset.v);
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
        alive = false;
        this.showTitle();
      }
      if (b.hasAttribute('data-go')) {
        if (!joined.length) return;
        alive = false;
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
      }
    });
    this.show(s);
  }

  // ---------------------------------------------------------------- Game start / flow

  startLocal(cfg: GameConfig, locals: LocalPlayer[]) {
    this.clear();
    this.lastConfig = { cfg, locals };
    const sess = new LocalSession(cfg, locals);
    this.app.start(sess, sess.game);
    document.body.classList.add('ingame');
    this.showIntro();
  }

  /** Role cards before the 3-2-1 countdown. */
  showIntro() {
    const s = this.app.session;
    if (!s) return;
    this.clearIntro();
    this.app.intro = 4.2;
    const S = s.state;
    s.locals.forEach((lp, i) => {
      const me = S.chars[lp.charId];
      const card = el('div', 'intro-card');
      const dev = lp.device;
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
    setTimeout(() => this.clearIntro(), 4200);
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
      if (s.kind === 'local') s.paused = false;
      return;
    }
    if (s.kind === 'local') s.paused = true;
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
          if (s.kind === 'local') s.paused = false;
        }, true);
      }
      if (a === 'quit') this.showTitle();
    });
    this.overlay = o;
    this.app.uiRoot.appendChild(o);
    setTimeout(() => (o.querySelector('button') as HTMLElement)?.focus(), 30);
  }

  // ---------------------------------------------------------------- End screen

  showEnd(S: GameState) {
    if (!this.app.session) return;
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
    const o = el('div', 'screen dim');
    const isNet = this.app.session.kind === 'net';
    o.innerHTML = `<div class="end-banner ${tofuWon ? '' : 'humans'}">${tofuWon ? '😈 TOFU A GAGNÉ !' : '🎉 LES HUMAINS ONT GAGNÉ !'}</div>
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
        </div>
        ${awards.length ? `<div class="awards">${awards.map((a) => `<span class="award">${a}</span>`).join('')}</div>` : ''}
        <div class="foot">
          <button class="big" data-a="menu" data-back>🏠 Menu</button>
          <div class="row">
            <button class="big" data-a="rotate">🔁 Revanche (changer Tofu)</button>
            <button class="big primary" data-a="again">🔄 Revanche</button>
          </div>
        </div>
      </div>`;
    o.addEventListener('click', (e) => {
      const b = (e.target as HTMLElement).closest('button');
      if (!b) return;
      sfx.play('click');
      const a = b.dataset.a;
      if (a === 'menu') this.showTitle();
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
    setTimeout(() => (o.querySelector('button.primary') as HTMLElement)?.focus(), 30);
  }

  // ---------------------------------------------------------------- How to play / settings

  showHowTo() {
    const s = el('div', 'screen dim');
    const k = (c: string) => `<kbd>${keyLabel(c)}</kbd>`;
    s.innerHTML = `<div class="panel">
      <h2>❓ Comment jouer</h2>
      <div class="cols">
        <div><h3>🐶 Tofu, le labrador</h3>
          <p>Remplis la barre de <b>bêtises</b> (100 points) ou empêche les humains de finir avant la fin du temps.</p>
          <p>Vole des chaussettes et cache-les dans ton panier, renverse les pots, poursuis le chat, roule-toi dans la boue puis cours dans la maison, renverse les poubelles, mange le goûter… Tu as 3 <b>défis secrets</b> qui rapportent gros !</p>
          <p>Les bêtises variées remplissent les <b>zoomies</b> : un sprint fou qui renverse tout.</p>
          <p>Tu passes par la chatière et par le trou de la haie, et sous les tables. Les portes fermées se poussent (maintenir Action).</p></div>
        <div><h3>🧹 Les humains</h3>
          <p>Finissez toutes les <b>tâches</b> de la liste et gardez la maison <b>propre</b> (barre verte au-dessus du trait) : les invités arrivent alors !</p>
          <p>Rattrapez Tofu pour <b>reprendre</b> ce qu'il porte, essuyez ses pattes, nettoyez les désordres (maintenir Action).</p>
          <p>Lancez une <b>friandise</b> : Tofu ne résiste pas et lâche tout. Fermez les portes pour le ralentir. Attention : en courant, on peut glisser ou renverser des choses !</p></div>
      </div>
      <h3>🎮 Commandes</h3>
      <table class="keys">
        <tr><td></td><td><b>Clavier</b></td><td><b>Clavier droit</b></td><td><b>Manette</b></td></tr>
        <tr><td>Bouger</td><td>${k('KeyW')}${k('KeyA')}${k('KeyS')}${k('KeyD')} ou flèches</td><td>Flèches</td><td>Stick gauche</td></tr>
        <tr><td>Caméra</td><td>Souris (glisser), ${k('KeyQ')} ${k('KeyE')}, molette</td><td>${k('KeyO')} ${k('KeyP')}</td><td>Stick droit, LB/RB</td></tr>
        <tr><td>Action</td><td>${k('Space')}</td><td>${k('Enter')}</td><td>A</td></tr>
        <tr><td>Courir</td><td>${k('ShiftLeft')}</td><td>${k('ShiftRight')}</td><td>RT / LT</td></tr>
        <tr><td>Zoomies / Friandise</td><td>${k('KeyF')}</td><td>${k('Slash')}</td><td>X</td></tr>
        <tr><td>Aboyer / Appeler</td><td>${k('KeyR')}</td><td>${k('Period')}</td><td>B</td></tr>
        <tr><td>S'asseoir (Tofu)</td><td>${k('KeyC')}</td><td>${k('Comma')}</td><td>Y</td></tr>
        <tr><td>Vue du dessus</td><td>${k('KeyV')}</td><td>Pavé 5</td><td>Select</td></tr>
        <tr><td>Pause</td><td>${k('Escape')}</td><td>⌫</td><td>Start</td></tr>
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

/** Gamepad that may be plugged in later (uses the first connected pad). */
export class LazyPad implements InputDevice {
  readonly kind = 'gamepad' as const;
  readonly id = 'pad-any';
  readonly label = 'Manette';
  private dev: GamepadDevice | null = null;
  poll(dt: number) {
    if (!this.dev || !this.dev.connected) {
      const p = listGamepads()[0];
      this.dev = p ? new GamepadDevice('pad' + p.index, 'Manette', p.index) : null;
    }
    return this.dev ? this.dev.poll(dt) : { mx: 0, my: 0, yaw: 0, pitch: 0, zoom: 0, buttons: 0, pause: false, tactical: false };
  }
  anyPressed() {
    return this.dev?.anyPressed() ?? false;
  }
}
