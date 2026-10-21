// Runs the authoritative simulation in the browser: solo, local split screen
// and the attract mode on the title screen.
import { SIM_DT } from '../../shared/constants';
import { createAI, AIController } from '../../shared/ai/ai';
import { Game } from '../../shared/sim/game';
import type { GameConfig, GameEvent, GameState, InputFrame } from '../../shared/sim/types';
import { PrevSnapshot, captureSnapshot } from '../render/gameView';
import type { LocalPlayer, Session } from './session';

export class LocalSession implements Session {
  readonly kind = 'local' as const;
  game: Game;
  locals: LocalPlayer[];
  alpha = 0;
  prev: PrevSnapshot;
  paused = false;
  private acc = 0;
  /** Longest frame time simulated (bigger values catch up after slow frames). */
  maxFrameDt = 0.1;
  private ais = new Map<number, AIController>();
  private events: GameEvent[] = [];
  private cfg: GameConfig;

  constructor(cfg: GameConfig, locals: LocalPlayer[]) {
    this.cfg = cfg;
    this.game = new Game(cfg);
    this.locals = locals;
    this.prev = captureSnapshot(this.game.state);
    this.setupAI();
  }

  get state(): GameState {
    return this.game.state;
  }

  private setupAI() {
    this.ais.clear();
    for (const c of this.game.state.chars) {
      if (c.ai) this.ais.set(c.id, createAI(this.game, c.id, this.cfg.difficulty ?? 1));
    }
  }

  update(dt: number): void {
    if (this.paused) return;
    // Poll local devices once per frame and convert to camera-relative input.
    const frames: (InputFrame | undefined)[] = [];
    for (const lp of this.locals) {
      const raw = lp.raw;
      if (!raw) continue;
      const w = lp.rig.toWorld(raw.mx, raw.my);
      frames[lp.charId] = { mx: w.x, mz: w.z, buttons: raw.buttons };
    }
    this.acc += Math.min(dt, this.maxFrameDt);
    let steps = 0;
    const maxSteps = Math.ceil(this.maxFrameDt / SIM_DT);
    while (this.acc >= SIM_DT && steps < maxSteps) {
      captureSnapshot(this.game.state, this.prev);
      const inputs = frames.slice();
      for (const [id, ai] of this.ais) inputs[id] = ai.think();
      this.game.step(inputs);
      for (const e of this.game.drainEvents()) this.events.push(e);
      this.acc -= SIM_DT;
      steps++;
    }
    if (steps === maxSteps) this.acc = 0;
    this.alpha = this.acc / SIM_DT;
  }

  drainEvents(): GameEvent[] {
    const e = this.events;
    this.events = [];
    return e;
  }

  rematch(rotateTofu: boolean) {
    const players = this.cfg.players.map((p) => ({ ...p }));
    if (rotateTofu) rotateTofuRole(players, this.locals);
    this.cfg = { ...this.cfg, seed: (this.cfg.seed * 7919 + 13) >>> 0, players };
    this.game = new Game(this.cfg);
    this.prev = captureSnapshot(this.game.state);
    this.acc = 0;
    this.setupAI();
  }

  dispose(): void {
    this.ais.clear();
  }
}

/**
 * Rotates the Tofu role among human-controlled players: the next local player
 * becomes Tofu. Character slots keep their index; we swap roles and names.
 */
export function rotateTofuRole(players: GameConfig['players'], locals: LocalPlayer[]) {
  const tofuIdx = players.findIndex((p) => p.role === 'tofu');
  const controlled = locals.map((l) => l.charId).sort((a, b) => a - b);
  if (controlled.length < 2) return;
  const cur = controlled.indexOf(tofuIdx);
  const next = controlled[(cur + 1) % controlled.length];
  const a = players[tofuIdx];
  const b = players[next];
  players[tofuIdx] = { ...b, role: 'tofu' };
  players[next] = { ...a, role: 'human', avatar: a.avatar };
  // Local players follow their person: swap their char ids.
  for (const l of locals) {
    if (l.charId === tofuIdx) l.charId = next;
    else if (l.charId === next) l.charId = tofuIdx;
  }
}
