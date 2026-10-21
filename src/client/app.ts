// Application core: render loop, viewports (split screen), sessions, events.
import * as THREE from 'three';
import type { Game } from '../shared/sim/game';
import type { Character, GameEvent, GameState } from '../shared/sim/types';
import { Anim } from '../shared/sim/types';
import { ITEM_TYPES } from '../shared/world/itemTypes';
import { sfx } from './audio/sfx';
import { endFrame } from './input/devices';
import { CameraRig } from './render/camera';
import { Effects } from './render/effects';
import { GameView } from './render/gameView';
import { GameRenderer, Quality, ViewRect, detectQuality } from './render/renderer';
import type { LocalPlayer, Session } from './runtime/session';
import { PlayerHud, TopBar, eventToast } from './ui/hud';

export interface AppHooks {
  onEnd?(S: GameState): void;
  onPauseRequest?(slot: number): void;
}

const tmpV = new THREE.Vector3();

export class App {
  readonly gr: GameRenderer;
  readonly canvas: HTMLCanvasElement;
  readonly hudRoot: HTMLElement;
  readonly uiRoot: HTMLElement;
  session: Session | null = null;
  view: GameView | null = null;
  effects: Effects;
  /** Game instance used for read-only helpers (prompts, objectives). */
  helper: Game | null = null;
  private huds: PlayerHud[] = [];
  private topBar: TopBar | null = null;
  private last = performance.now();
  private overviewCam = new THREE.PerspectiveCamera(45, 1, 1, 300);
  private attract = false;
  private attractRig = new CameraRig();
  private attractT = 0;
  hooks: AppHooks = {};
  private endNotified = false;
  private lastPhase = '';
  private lastCountdown = 4;
  private frameCount = 0;
  private fpsAcc = 0;
  private fpsFrames = 0;
  fps = 60;
  intro = 0;

  constructor() {
    this.canvas = document.getElementById('view') as HTMLCanvasElement;
    this.hudRoot = document.getElementById('hud-root')!;
    this.uiRoot = document.getElementById('ui-root')!;
    let q: Quality = detectQuality();
    const pq = new URLSearchParams(location.search).get('q');
    if (pq === 'high' || pq === 'medium' || pq === 'low') q = pq;
    this.gr = new GameRenderer(this.canvas, q);
    this.effects = new Effects(this.gr.scene);
    window.addEventListener('resize', () => this.resize());
    this.resize();
    requestAnimationFrame((t) => this.frame(t));
  }

  resize() {
    this.gr.setSize(window.innerWidth, window.innerHeight);
    this.layout();
  }

  /** Starts a session (local or network) with its local players. */
  start(session: Session, helper: Game, attract = false) {
    this.stop();
    this.session = session;
    this.helper = helper;
    this.attract = attract;
    this.view = new GameView(this.gr.scene, session.state);
    this.endNotified = false;
    this.lastPhase = '';
    this.lastCountdown = 4;
    if (!attract) {
      this.topBar = new TopBar(this.hudRoot);
      this.huds = session.locals.map((lp) => new PlayerHud(this.hudRoot, lp));
    }
    this.layout();
  }

  /** Rebuilds the dynamic view after a rematch (new Game instance). */
  rebuildView(helper: Game) {
    if (!this.session) return;
    this.helper = helper;
    if (this.view) this.gr.scene.remove(this.view.root);
    this.view = new GameView(this.gr.scene, this.session.state);
    for (const h of this.huds) h.dispose();
    this.huds = this.session.locals.map((lp) => new PlayerHud(this.hudRoot, lp));
    this.endNotified = false;
    this.lastPhase = '';
    this.lastCountdown = 4;
    this.layout();
  }

  stop() {
    if (this.view) this.gr.scene.remove(this.view.root);
    this.view = null;
    this.session?.dispose();
    this.session = null;
    for (const h of this.huds) h.dispose();
    this.huds = [];
    this.topBar?.el.remove();
    this.topBar = null;
    this.hudRoot.innerHTML = '';
  }

  /** Computes viewport rectangles for the local players. */
  layout() {
    const W = window.innerWidth;
    const H = window.innerHeight;
    const s = this.session;
    if (!s) return;
    const n = s.locals.length;
    const rects: ViewRect[] = [];
    if (n <= 1) rects.push({ x: 0, y: 0, w: W, h: H });
    else if (n === 2) {
      if (W >= H * 1.1) {
        rects.push({ x: 0, y: 0, w: Math.floor(W / 2) - 1, h: H }, { x: Math.ceil(W / 2) + 1, y: 0, w: Math.floor(W / 2) - 1, h: H });
      } else {
        rects.push({ x: 0, y: 0, w: W, h: Math.floor(H / 2) - 1 }, { x: 0, y: Math.ceil(H / 2) + 1, w: W, h: Math.floor(H / 2) - 1 });
      }
    } else {
      const hw = Math.floor(W / 2) - 1;
      const hh = Math.floor(H / 2) - 1;
      rects.push({ x: 0, y: 0, w: hw, h: hh }, { x: W - hw, y: 0, w: hw, h: hh }, { x: 0, y: H - hh, w: hw, h: hh });
    }
    s.locals.forEach((lp, i) => {
      lp.rect = rects[i] ?? rects[0];
      lp.rig.setAspect(lp.rect.w / lp.rect.h);
      this.huds[i]?.layout(lp.rect, n > 1);
    });
    this.hudRoot.classList.toggle('split', n > 1);
  }

  private overviewRect(): ViewRect | null {
    const s = this.session;
    if (!s || s.locals.length !== 3) return null;
    const W = window.innerWidth;
    const H = window.innerHeight;
    const hw = Math.floor(W / 2) - 1;
    const hh = Math.floor(H / 2) - 1;
    return { x: W - hw, y: H - hh, w: hw, h: hh };
  }

  private frame(now: number) {
    const dt = Math.min(0.1, (now - this.last) / 1000);
    this.last = now;
    this.fpsAcc += dt;
    this.fpsFrames++;
    if (this.fpsAcc >= 1) {
      this.fps = this.fpsFrames / this.fpsAcc;
      this.fpsAcc = 0;
      this.fpsFrames = 0;
    }
    try {
      this.tick(dt);
    } catch (e) {
      console.error(e);
    }
    endFrame();
    this.frameCount++;
    if (this.frameCount === 3) (window as unknown as { __ready: boolean }).__ready = true;
    requestAnimationFrame((t) => this.frame(t));
  }

  private tick(dt: number) {
    const s = this.session;
    this.gr.beginFrame();
    if (!s || !this.view) {
      // Nothing to show: plain world orbit.
      this.renderAttract(dt, null);
      return;
    }
    // Inputs.
    for (const lp of s.locals) {
      lp.raw = lp.device.poll(dt);
      if (lp.raw.pause) this.hooks.onPauseRequest?.(lp.slot);
      if (lp.raw.tactical) lp.rig.tactical = !lp.rig.tactical;
    }
    if (this.intro > 0) {
      this.intro -= dt;
      for (const lp of s.locals) if (lp.raw) lp.raw = { ...lp.raw, mx: 0, my: 0, buttons: 0 };
    }
    if (this.intro <= 0) s.update(dt);
    const S = s.state;
    this.view.sync(S, dt, s.alpha, s.prev);
    this.effects.update(dt);
    this.handleEvents(s.drainEvents(), S);
    this.ambientEffects(S, dt);

    if (this.attract) {
      this.renderAttract(dt, S);
      return;
    }
    // Countdown / phase sounds.
    if (S.phase === 'countdown' && this.intro <= 0) {
      const c = Math.ceil(S.countdown);
      if (c !== this.lastCountdown && c > 0) sfx.play('beep');
      this.lastCountdown = c;
    }
    if (S.phase !== this.lastPhase) {
      if (S.phase === 'play' && this.lastPhase === 'countdown') sfx.play('go');
      this.lastPhase = S.phase;
    }
    for (let i = 0; i < s.locals.length; i++) {
      const lp = s.locals[i];
      const me = S.chars[lp.charId];
      if (!me) continue;
      const raw = lp.raw!;
      lp.rig.update(dt, me.x, me.z, {
        yawInput: raw.yaw, pitchInput: raw.pitch, zoomInput: raw.zoom, facing: me.facing,
        moving: me.speed > 0.5, height: me.role === 'tofu' ? 0.6 : 1.0,
      });
      this.gr.renderView(lp.rig.camera, lp.rect, lp.rig.focus);
      // Interaction highlight.
      const inter = this.helper && S.phase === 'play' ? this.helperInteraction(me) : null;
      this.view.setHighlight(i, inter, me.role === 'tofu' ? 0xffb03b : 0x6fd3ff);
    }
    const ov = this.overviewRect();
    if (ov) {
      this.overviewCam.aspect = ov.w / ov.h;
      this.overviewCam.updateProjectionMatrix();
      this.overviewCam.position.set(-2, 58, 26);
      this.overviewCam.lookAt(-2, 0, -3);
      this.gr.renderView(this.overviewCam, ov, tmpV.set(-2, 0, -3), false);
    }
    this.topBar?.update(S);
    this.huds.forEach((h, i) => {
      const lp = s.locals[i];
      h.update(dt, this.helper!, S, lp.rig.camera, (id, out) => this.view!.headPos(S, id, out));
    });
    if (S.phase === 'end' && !this.endNotified) {
      this.endNotified = true;
      setTimeout(() => this.hooks.onEnd?.(S), 1800);
    }
  }

  private helperInteraction(me: Character) {
    // Imported lazily to avoid a cycle with the HUD module.
    const list = interactionsFor(this.helper!, me);
    const i = list[0];
    return i ? { x: i.x, y: i.y, z: i.z } : null;
  }

  private renderAttract(dt: number, S: GameState | null) {
    this.attractT += dt;
    const t = this.attractT * 0.05;
    const rig = this.attractRig;
    let fx = -3 + Math.sin(t * 0.7) * 8;
    let fz = 0 + Math.cos(t * 0.5) * 6;
    if (S) {
      const tofu = S.chars.find((c) => c.role === 'tofu');
      if (tofu) {
        fx = tofu.x;
        fz = tofu.z;
      }
    }
    rig.yaw = Math.PI + Math.sin(t) * 0.9;
    rig.pitch = 0.95;
    rig.dist = 15;
    rig.setAspect(window.innerWidth / window.innerHeight);
    rig.update(dt, fx, fz, { yawInput: 0, pitchInput: 0, zoomInput: 0 });
    this.gr.renderView(rig.camera, { x: 0, y: 0, w: window.innerWidth, h: window.innerHeight }, rig.focus);
  }

  // ---------------------------------------------------------------------------
  // Events → sound, particles, HUD
  // ---------------------------------------------------------------------------

  private nearestListener(x: number, z: number): number {
    const s = this.session;
    if (!s || this.attract) return 99;
    let best = 99;
    for (const lp of s.locals) {
      const c = s.state.chars[lp.charId];
      if (!c) continue;
      best = Math.min(best, Math.hypot(c.x - x, c.z - z));
    }
    return best;
  }

  private vol(x: number, z: number): number {
    const d = this.nearestListener(x, z);
    return d < 6 ? 1 : Math.max(0.12, 1 - (d - 6) / 26);
  }

  private handleEvents(evs: GameEvent[], S: GameState) {
    if (!this.view) return;
    const fx = this.effects;
    const tofu = S.chars.find((c) => c.role === 'tofu')!;
    const quiet = this.attract;
    for (const e of evs) {
      // Toasts per local player.
      if (!quiet) {
        this.huds.forEach((h, i) => {
          const me = S.chars[this.session!.locals[i].charId];
          const t = eventToast(e, me, S);
          if (t) h.toast(t);
        });
      }
      switch (e.t) {
        case 'bark': {
          const c = S.chars[e.id];
          if (!quiet) sfx.play('bark', this.vol(c.x, c.z));
          this.floatAll('WOUF !', c.x, 1.3, c.z, 'bark', e.id);
          break;
        }
        case 'say': {
          const c = S.chars[e.id];
          if (c) this.floatAll(e.text, c.x, 2.1, c.z, 'bubble', e.id);
          break;
        }
        case 'pickup':
          if (!quiet) sfx.play('pickup', this.vol(S.chars[e.id].x, S.chars[e.id].z));
          break;
        case 'steal':
          if (!quiet) sfx.play('steal', this.vol(e.x, e.z));
          break;
        case 'drop':
          if (!quiet) sfx.play('drop', this.vol(S.chars[e.id].x, S.chars[e.id].z) * 0.6);
          break;
        case 'store':
          if (!quiet) sfx.play('store', this.vol(S.chars[e.id].x, S.chars[e.id].z));
          break;
        case 'knock':
          fx.burst('dust', e.x, 0.2, e.z, 8);
          break;
        case 'land': {
          const it = S.items[e.item];
          if (e.hard) {
            if (!quiet) sfx.play('crash', this.vol(e.x, e.z));
            const t = ITEM_TYPES[it.type];
            const kind = t.knock?.mess === 'water' ? 'water' : t.knock?.mess === 'soil' ? 'dirt' : t.knock?.mess === 'trash' ? 'paper' : 'crash';
            fx.burst(kind, e.x, 0.1, e.z, 14);
            this.shakeNear(e.x, e.z, 0.12);
          } else if (!quiet) sfx.play('thud', this.vol(e.x, e.z) * 0.5);
          break;
        }
        case 'mess':
          break;
        case 'cleaned':
          if (!quiet) sfx.play('clean', this.vol(e.x, e.z));
          fx.burst('sparkle', e.x, 0.1, e.z, 16);
          this.floatAll('✨ Propre !', e.x, 0.8, e.z, 'good');
          break;
        case 'door':
          if (!quiet) {
            sfx.play('door', this.vol(S.chars[e.by]?.x ?? 0, S.chars[e.by]?.z ?? 0));
            if (e.open) sfx.play('creak', this.vol(S.chars[e.by]?.x ?? 0, S.chars[e.by]?.z ?? 0) * 0.7);
          }
          break;
        case 'muddy':
          if (!quiet) sfx.play('splash', this.vol(tofu.x, tofu.z));
          fx.burst('mud', tofu.x, 0.1, tofu.z, 18);
          break;
        case 'paws':
          fx.burst('sparkle', tofu.x, 0.2, tofu.z, 10);
          if (!quiet) sfx.play('clean', this.vol(tofu.x, tofu.z) * 0.7);
          break;
        case 'cat':
          if (e.what === 'hiss' || e.what === 'boop') {
            if (!quiet) sfx.play(e.what === 'boop' ? 'boop' : 'hiss', this.vol(e.x, e.z));
            this.floatAll(e.what === 'boop' ? 'PFFF !' : 'KSSS !', e.x, (S.cat.y || 0) + 0.9, e.z, 'cat');
          } else if (e.what === 'flee' && !quiet) sfx.play('meow', this.vol(e.x, e.z) * 0.8);
          break;
        case 'zoomies':
          if (e.on && !quiet) sfx.play('zoomies', this.vol(tofu.x, tofu.z));
          break;
        case 'treat':
          if (!quiet) sfx.play('whoosh', this.vol(e.x, e.z) * 0.6);
          break;
        case 'lured':
          if (!quiet) sfx.play('treat', this.vol(tofu.x, tofu.z));
          fx.burst('hearts', tofu.x, 1.0, tofu.z, 6);
          break;
        case 'eat':
          if (!quiet) sfx.play('crunch', this.vol(tofu.x, tofu.z));
          fx.burst('crumbs', tofu.x, 0.3, tofu.z, 10);
          break;
        case 'throw':
          if (!quiet) sfx.play('whoosh', this.vol(S.chars[e.id].x, S.chars[e.id].z));
          break;
        case 'slip': {
          const c = S.chars[e.id];
          if (!quiet) sfx.play('slip', this.vol(c.x, c.z));
          fx.burst('water', c.x, 0.1, c.z, 8);
          this.shakeNear(c.x, c.z, 0.15);
          break;
        }
        case 'chaos':
          if (e.reason && e.amount >= 1) this.floatAll(`+${Math.round(e.amount)} 😈`, e.x, 1.2, e.z, 'chaos');
          if (!quiet && e.amount >= 1) sfx.play('chaos', 0.7);
          break;
        case 'task':
          if (!quiet) sfx.play(e.done ? 'task' : 'taskLost');
          break;
        case 'secret':
          if (!quiet) sfx.play('secret');
          fx.burst('confetti', tofu.x, 0.5, tofu.z, 30);
          break;
        case 'guests':
          if (!quiet) {
            sfx.play(e.on ? 'doorbell' : 'alarm');
            sfx.setTense(e.on);
          }
          break;
        case 'startle': {
          const c = S.chars[e.id];
          if (!quiet) sfx.play('startle', this.vol(c.x, c.z));
          break;
        }
        case 'innocent':
          fx.burst('sparkle', tofu.x, 0.9, tofu.z, 8);
          break;
        case 'pet': {
          const c = S.chars[e.id];
          if (!quiet) sfx.play('pet', this.vol(c.x, c.z));
          fx.burst('hearts', tofu.x, 0.9, tofu.z, 7);
          break;
        }
        case 'water':
          if (e.station >= 0 && !quiet) sfx.play('splash', 0.6);
          break;
        case 'dig':
          fx.burst('dirt', tofu.x, 0.1, tofu.z, 16);
          if (!quiet) sfx.play('scrub', this.vol(tofu.x, tofu.z));
          break;
        case 'bed':
          if (!e.made) fx.burst('dust', tofu.x, 0.6, tofu.z, 10);
          break;
        case 'carrier':
          break;
        case 'end':
          sfx.setTense(false);
          if (!quiet) {
            const localTofu = this.session?.locals.some((l) => S.chars[l.charId]?.role === 'tofu');
            const localHuman = this.session?.locals.some((l) => S.chars[l.charId]?.role === 'human');
            const won = (e.winner === 'tofu' && localTofu) || (e.winner === 'humans' && localHuman);
            sfx.play(won ? 'win' : 'lose');
          }
          fx.burst('confetti', tofu.x, 0.5, tofu.z, 60);
          break;
      }
    }
  }

  private dustT = 0;
  private ambientEffects(S: GameState, dt: number) {
    this.dustT += dt;
    if (this.dustT < 0.06) return;
    this.dustT = 0;
    for (const c of S.chars) {
      if (c.role === 'tofu') {
        if (c.zoomT > 0) this.effects.burst('zoom', c.x, 0.1, c.z, 2, Math.sin(c.facing), Math.cos(c.facing));
        if ((c.anim === Anim.Run || c.zoomT > 0) && c.speed > 3) this.effects.burst('dust', c.x, 0, c.z, 1, Math.sin(c.facing), Math.cos(c.facing));
        if (c.mud > 0.3 && c.speed > 1 && Math.random() < 0.3) this.effects.burst('mud', c.x, 0.05, c.z, 1);
        if (c.anim === Anim.Dig) this.effects.burst('dirt', c.x + Math.sin(c.facing) * 0.5, 0.05, c.z + Math.cos(c.facing) * 0.5, 2);
      } else if (c.anim === Anim.Run && c.speed > 4) {
        this.effects.burst('dust', c.x, 0, c.z, 1, Math.sin(c.facing), Math.cos(c.facing));
      } else if (c.anim === Anim.Clean && Math.random() < 0.3) {
        this.effects.burst('sparkle', c.x + Math.sin(c.facing) * 0.6, 0.0, c.z + Math.cos(c.facing) * 0.6, 1);
        if (!this.attract && this.nearestListener(c.x, c.z) < 8) sfx.play('scrub', 0.5);
      }
    }
  }

  private floatAll(text: string, x: number, y: number, z: number, cls: string, follow?: number) {
    for (const h of this.huds) h.floatText(text, x, y, z, cls, follow);
  }

  private shakeNear(x: number, z: number, a: number) {
    const s = this.session;
    if (!s) return;
    for (const lp of s.locals) {
      const c = s.state.chars[lp.charId];
      if (c && Math.hypot(c.x - x, c.z - z) < 7) lp.rig.addShake(a);
    }
  }

  hudFor(slot: number): PlayerHud | undefined {
    return this.huds[slot];
  }
}

// Late import to keep module graph simple.
import { listInteractions } from '../shared/sim/interactions';
function interactionsFor(g: Game, c: Character) {
  return listInteractions(g, c);
}

export type { LocalPlayer };
