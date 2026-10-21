// Network game session. The server owns the game: this mirror applies its
// delta snapshots, shows other characters ~100 ms in the past (smooth
// interpolation between snapshots) and predicts the local characters with the
// shared movement code, replaying unacknowledged inputs after each snapshot.
import { BTN_ALL, BTN_INTERACT, DOG, SIM_DT } from '../../shared/constants';
import { lerp, lerpAngle } from '../../shared/math';
import { applySnap } from '../../shared/net/snapshot';
import { Game } from '../../shared/sim/game';
import { MoveContext, applyMovement, moveCharacter } from '../../shared/sim/movement';
import { Anim } from '../../shared/sim/types';
import type { Character, GameEvent, GameState, InputFrame } from '../../shared/sim/types';
import type { NetClient, SnapMsg, StartMsg } from './netClient';
import type { LocalPlayer, Session } from './session';

/** Render delay for remote objects (two snapshots at 20 Hz). */
const INTERP_DELAY = 0.1;
const MAX_PENDING = 240;
const MAX_STEPS = 15;

interface Pred {
  lp: LocalPlayer;
  seat: number;
  charId: number;
  /** Predicted character (server state + replayed inputs). */
  c: Character;
  pending: { seq: number; inp: InputFrame }[];
  /** Visual offset left by corrections; decays quickly. */
  errX: number;
  errZ: number;
  sitting: boolean;
  anim: Anim;
  animT: number;
}

/** Positions of moving things at one server tick. */
interface Frame {
  t: number;
  chars: number[];
  cat: number[];
  carrier: number[];
  vacuum: number[];
  air: Map<number, number[]>;
  treats: Map<number, number[]>;
}

const LOCO = new Set<Anim>([Anim.Idle, Anim.Walk, Anim.Run, Anim.Sit]);

function cloneChar(c: Character): Character {
  return {
    ...c, hold: [...c.hold], act: c.act ? { ...c.act } : null,
    innocentDone: [...c.innocentDone], recentMischief: [...c.recentMischief],
  };
}

export class NetSession implements Session {
  readonly kind = 'net' as const;
  /** State shown by the view (interpolated / predicted copy of `auth`). */
  state: GameState;
  /** Latest authoritative state received from the server. */
  readonly auth: GameState;
  /** Game wrapper around `auth` for read-only helpers (prompts, objectives). */
  readonly helper: Game;
  locals: LocalPlayer[];
  alpha = 1;
  paused = false;
  /** Last snapshot time (performance.now, ms) to detect a stalled link. */
  lastSnapAt = performance.now();
  private preds: Pred[] = [];
  private predByChar = new Map<number, Pred>();
  private frames: Frame[] = [];
  private clockOff: number | null = null;
  private acc = 0;
  private seq = 0;
  private events: GameEvent[] = [];
  private readonly onSnapFn = (m: SnapMsg) => this.onSnap(m);

  constructor(private net: NetClient, start: StartMsg, locals: LocalPlayer[]) {
    this.auth = start.state;
    this.helper = new Game(start.cfg);
    this.helper.adoptState(this.auth);
    this.locals = locals;
    for (const lp of locals) {
      if (lp.spectator || lp.seat === undefined) continue;
      const c = this.auth.chars[lp.charId];
      const p: Pred = {
        lp, seat: lp.seat, charId: lp.charId, c: cloneChar(c), pending: [], errX: 0, errZ: 0, sitting: false, anim: c.anim, animT: c.animT,
      };
      this.preds.push(p);
      this.predByChar.set(lp.charId, p);
    }
    this.pushFrame(this.auth.tick * SIM_DT);
    this.state = this.buildView(0);
    net.onSnap = this.onSnapFn;
  }

  private ctx(): MoveContext {
    return { world: this.helper.world, doors: this.auth.doors, items: this.auth.items };
  }

  // ------------------------------------------------------------ server data

  private onSnap(m: SnapMsg) {
    applySnap(this.auth, m.d);
    for (const e of m.d.ev) this.events.push(e);
    this.lastSnapAt = performance.now();
    // Server clock estimate: follow early packets quickly, late ones slowly.
    const st = m.d.tick * SIM_DT;
    const off = st - performance.now() / 1000;
    if (this.clockOff === null || Math.abs(off - this.clockOff) > 1) this.clockOff = off;
    else this.clockOff += (off - this.clockOff) * (off > this.clockOff ? 0.25 : 0.03);
    this.pushFrame(st);
    for (const p of this.preds) this.reconcile(p, m.ack[p.seat]);
  }

  private pushFrame(t: number) {
    const S = this.auth;
    const f: Frame = {
      t, chars: [], cat: [S.cat.x, S.cat.y, S.cat.z, S.cat.facing], carrier: [S.carrier.x, S.carrier.z, S.carrier.facing],
      vacuum: [S.vacuum.x, S.vacuum.z, S.vacuum.facing],
      air: new Map(), treats: new Map(),
    };
    for (const c of S.chars) f.chars.push(c.x, c.z, c.facing);
    for (const it of S.items) if (it.state === 'air') f.air.set(it.idx, [it.x, it.y, it.z]);
    for (const tr of S.treats) f.treats.set(tr.id, [tr.x, tr.y, tr.z]);
    this.frames.push(f);
    if (this.frames.length > 40) this.frames.shift();
  }

  /** Restarts the prediction from the server state and replays newer inputs. */
  private reconcile(p: Pred, ack: number | undefined) {
    if (ack !== undefined) {
      let n = 0;
      while (n < p.pending.length && p.pending[n].seq <= ack) n++;
      if (n) p.pending.splice(0, n);
    }
    const shownX = p.c.x + p.errX;
    const shownZ = p.c.z + p.errZ;
    p.c = cloneChar(this.auth.chars[p.charId]);
    for (const x of p.pending) this.predictStep(p, x.inp);
    const ex = shownX - p.c.x;
    const ez = shownZ - p.c.z;
    if (ex * ex + ez * ez > 9) {
      p.errX = 0;
      p.errZ = 0;
    } else {
      p.errX = ex;
      p.errZ = ez;
    }
  }

  /** Movement part of the server's character update (see Game.updateChar). */
  private predictStep(p: Pred, inp: InputFrame) {
    const c = p.c;
    const dt = SIM_DT;
    if (this.auth.phase !== 'play') {
      c.vx = c.vz = c.speed = 0;
      return;
    }
    c.lockT = Math.max(0, c.lockT - dt);
    c.pantT = Math.max(0, c.pantT - dt);
    if (c.zoomT > 0) {
      c.zoomT -= dt;
      if (c.zoomT <= 0) {
        c.zoomT = 0;
        c.pantT = DOG.pantTime;
      }
    }
    if (c.stun > 0) {
      c.stun -= dt;
      c.act = null;
      moveCharacter(c, 0, 0, 0, dt, this.ctx(), false);
      return;
    }
    if (c.lureKind) return; // the server walks Tofu to the treat
    if (c.act && !(inp.buttons & BTN_INTERACT)) c.act = null;
    p.sitting = applyMovement(c, inp, dt, this.ctx());
  }

  // ------------------------------------------------------------ per frame

  private sample(p: Pred): InputFrame {
    const raw = p.lp.raw;
    if (!raw || this.paused) return { mx: 0, mz: 0, buttons: 0 };
    const w = p.lp.rig.toWorld(raw.mx, raw.my);
    // Same rounding and clamping as the server so the prediction matches.
    let mx = Math.round(Math.max(-1, Math.min(1, w.x)) * 1000) / 1000;
    let mz = Math.round(Math.max(-1, Math.min(1, w.z)) * 1000) / 1000;
    const l = Math.hypot(mx, mz);
    if (l > 1) {
      mx /= l;
      mz /= l;
    }
    return { mx, mz, buttons: raw.buttons & BTN_ALL };
  }

  update(dt: number): void {
    this.acc += Math.min(dt, 0.25);
    const out: [number, number, number, number, number][] = [];
    let steps = 0;
    while (this.acc >= SIM_DT && steps < MAX_STEPS) {
      this.acc -= SIM_DT;
      steps++;
      for (const p of this.preds) {
        const inp = this.sample(p);
        const seq = ++this.seq;
        out.push([p.seat, seq, inp.mx, inp.mz, inp.buttons]);
        p.pending.push({ seq, inp });
        if (p.pending.length > MAX_PENDING) p.pending.shift();
        this.predictStep(p, inp);
      }
    }
    if (steps === MAX_STEPS) this.acc = 0;
    if (out.length) this.net.send({ t: 'in', f: out });
    this.state = this.buildView(dt);
  }

  /** Two frames around the render time and the blend factor between them. */
  private bracket(): [Frame, Frame, number] {
    const fr = this.frames;
    const rt = performance.now() / 1000 + (this.clockOff ?? 0) - INTERP_DELAY;
    let i = fr.length - 1;
    while (i > 0 && fr[i].t > rt) i--;
    const a = fr[i];
    const b = fr[Math.min(fr.length - 1, i + 1)];
    if (a === b || b.t <= a.t) return [a, a, 0];
    return [a, b, Math.max(0, Math.min(1, (rt - a.t) / (b.t - a.t)))];
  }

  private buildView(dt: number): GameState {
    const S = this.auth;
    const [a, b, t] = this.bracket();
    const view: GameState = { ...S };
    const decay = Math.exp(-dt * 12);
    view.chars = S.chars.map((c, i) => {
      const p = this.predByChar.get(c.id);
      if (p && !p.c.lureKind) {
        p.errX *= decay;
        p.errZ *= decay;
        const v: Character = { ...p.c, x: p.c.x + p.errX, z: p.c.z + p.errZ };
        // Walk/run/sit react at once; one-shot animations come from the server.
        if (S.phase === 'play' && LOCO.has(c.anim) && !p.c.act && p.c.lockT <= 0 && p.c.stun <= 0) {
          const dog = c.role === 'tofu';
          const sp = p.c.speed;
          const want = sp > 0.35 ? (dog ? (sp > DOG.walk + 0.3 ? Anim.Run : Anim.Walk) : sp > 4.3 ? Anim.Run : Anim.Walk) : p.sitting ? Anim.Sit : Anim.Idle;
          if (want !== p.anim) {
            p.anim = want;
            p.animT = 0;
          } else p.animT += dt;
          v.anim = p.anim;
          v.animT = p.animT;
        } else {
          p.anim = c.anim;
          p.animT = c.animT;
          v.anim = c.anim;
          v.animT = c.animT;
        }
        return v;
      }
      const k = i * 3;
      if (a.chars.length <= k + 2 || b.chars.length <= k + 2) return c;
      return {
        ...c, x: lerp(a.chars[k], b.chars[k], t), z: lerp(a.chars[k + 1], b.chars[k + 1], t),
        facing: lerpAngle(a.chars[k + 2], b.chars[k + 2], t),
      };
    });
    view.cat = {
      ...S.cat, x: lerp(a.cat[0], b.cat[0], t), y: lerp(a.cat[1], b.cat[1], t), z: lerp(a.cat[2], b.cat[2], t),
      facing: lerpAngle(a.cat[3], b.cat[3], t),
    };
    if (S.vacuum.mode !== 'dock') {
      view.vacuum = { ...S.vacuum, x: lerp(a.vacuum[0], b.vacuum[0], t), z: lerp(a.vacuum[1], b.vacuum[1], t), facing: lerpAngle(a.vacuum[2], b.vacuum[2], t) };
    }
    if (S.carrier.active) {
      view.carrier = { ...S.carrier, x: lerp(a.carrier[0], b.carrier[0], t), z: lerp(a.carrier[1], b.carrier[1], t), facing: lerpAngle(a.carrier[2], b.carrier[2], t) };
    }
    view.items = S.items.map((it) => {
      if (it.state !== 'air') return it;
      const pa = a.air.get(it.idx);
      const pb = b.air.get(it.idx);
      if (!pa || !pb) return it;
      return { ...it, x: lerp(pa[0], pb[0], t), y: lerp(pa[1], pb[1], t), z: lerp(pa[2], pb[2], t) };
    });
    view.treats = S.treats.map((tr) => {
      const pa = a.treats.get(tr.id);
      const pb = b.treats.get(tr.id);
      if (!pa || !pb) return tr;
      return { ...tr, x: lerp(pa[0], pb[0], t), y: lerp(pa[1], pb[1], t), z: lerp(pa[2], pb[2], t) };
    });
    return view;
  }

  drainEvents(): GameEvent[] {
    const e = this.events;
    this.events = [];
    return e;
  }

  dispose(): void {
    if (this.net.onSnap === this.onSnapFn) this.net.onSnap = null;
  }
}
