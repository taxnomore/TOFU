import { describe, expect, it } from 'vitest';
import { Game } from '../src/shared/sim/game';
import { createAI } from '../src/shared/ai/ai';
import { SIM_HZ } from '../src/shared/constants';
import type { GameEvent, PlayerSlot } from '../src/shared/sim/types';
import { MASK_DOG, MASK_HUMAN } from '../src/shared/world/types';
import { listInteractions } from '../src/shared/sim/interactions';
import { place } from './helpers';
import type { Variant } from '../src/shared/world/variants';

function runMatch(humans: number, seed: number, duration = 240, difficulty = 1, variant: Variant = 'ete') {
  const players: PlayerSlot[] = [{ role: 'tofu', name: 'Tofu', avatar: 0, ai: true }];
  for (let i = 0; i < humans; i++) players.push({ role: 'human', name: `H${i}`, avatar: i, ai: true });
  const g = new Game({ seed, duration, players, noCountdown: true, difficulty, variant });
  const ais = g.state.chars.map((c) => createAI(g, c.id, difficulty));
  const events: GameEvent[] = [];
  let embedded = 0;
  let tick = 0;
  while (g.state.phase !== 'end' && tick < (duration + 30) * SIM_HZ) {
    g.step(ais.map((a) => a.think()));
    for (const e of g.drainEvents()) events.push(e);
    tick++;
    if (tick % (5 * SIM_HZ) === 0) {
      for (const c of g.state.chars) {
        const mask = c.role === 'tofu' ? MASK_DOG : MASK_HUMAN;
        if (g.world.cols.overlaps(c.x, c.z, 0.12, mask)) embedded++;
      }
    }
  }
  return { g, events, embedded };
}

describe('AI', () => {
  it('1 Tofu vs 1 human: full match with real actions on both sides', () => {
    const { g, events, embedded } = runMatch(1, 4242);
    const S = g.state;
    expect(S.phase).toBe('end');
    expect(S.winner).not.toBeNull();
    expect(S.stats.itemsStolen + S.stats.knocks).toBeGreaterThan(2);
    expect(S.stats.messesCleaned + S.stats.recovered).toBeGreaterThan(2);
    expect(events.some((e) => e.t === 'task' && e.done)).toBe(true);
    expect(embedded).toBe(0);
  });

  it('1 Tofu vs 2 humans: humans cooperate and the game ends', () => {
    const { g, events, embedded } = runMatch(2, 777);
    const S = g.state;
    expect(S.phase).toBe('end');
    expect(S.tasks.filter((t) => t.done).length).toBeGreaterThan(1);
    // Both humans did something useful.
    const humans = S.chars.filter((c) => c.role === 'human');
    for (const h of humans) {
      const st = S.charStats[h.id] ?? {};
      const did = (st.cleaned ?? 0) + (st.recovered ?? 0) + (st.returned ?? 0) + (st.doors ?? 0);
      const stored = events.filter((e) => e.t === 'store' && e.id === h.id).length;
      expect(did + stored, h.name).toBeGreaterThan(0);
    }
    expect(embedded).toBe(0);
  });

  it('full rounds in every ambiance: the computer uses its mischief and nobody gets stuck', () => {
    const seen = { automne: 'leavesScattered', hiver: 'snowmen', marche: 'marketStolen' } as const;
    for (const v of ['automne', 'hiver', 'marche'] as const) {
      let n = 0;
      for (const seed of [11, 12]) {
        const { g, embedded } = runMatch(1, seed, 200, 2, v);
        expect(g.state.phase, v).toBe('end');
        expect(embedded, v).toBe(0);
        n += g.state.stats[seen[v]];
      }
      expect(n, `${v}: ${seen[v]}`).toBeGreaterThan(0);
    }
  });

  it('AI Tofu uses varied mischief across seeds', () => {
    let kinds = new Set<string>();
    for (const seed of [1, 2, 3]) {
      const { events } = runMatch(1, seed, 150);
      for (const e of events) {
        if (e.t === 'steal') kinds.add('steal');
        if (e.t === 'knock') kinds.add('knock');
        if (e.t === 'muddy') kinds.add('mud');
        if (e.t === 'cat' && e.what === 'flee') kinds.add('cat');
        if (e.t === 'bark') kinds.add('bark');
      }
    }
    expect(kinds.size).toBeGreaterThanOrEqual(4);
    kinds = new Set();
  });
});

describe('smarter computer players', () => {
  function setup(humanPlayer = false) {
    const players: PlayerSlot[] = [
      { role: 'tofu', name: 'Tofu', avatar: 0, ai: true },
      { role: 'human', name: 'Ordi', avatar: 0, ai: true },
    ];
    if (humanPlayer) players.push({ role: 'human', name: 'Joueur', avatar: 1, ai: false });
    const g = new Game({ seed: 5, duration: 360, players, noCountdown: true, difficulty: 1 });
    const ais = g.state.chars.map((c) => (c.ai ? createAI(g, c.id, 1) : null));
    const step = (n: number) => {
      for (let i = 0; i < n; i++) g.step(ais.map((a) => a?.think()));
    };
    return { g, step };
  }

  it('a human switches off the robot vacuum that Tofu started', () => {
    const { g, step } = setup();
    const S = g.state;
    const v = S.vacuum;
    // Tofu started it, then went to sleep in the garden; the human is in the hall.
    Object.assign(v, { mode: 'run', t: 25, by: g.tofuId, turnT: 9, facing: Math.PI / 2 });
    place(g.tofu, -10, 18, 0);
    g.tofu.stun = 99;
    place(S.chars[1], -1, 2, 0);
    let off = -1;
    for (let i = 0; i < 12 * 60 && off < 0; i++) {
      step(1);
      if (v.mode !== 'run') off = i;
    }
    expect(off, 'switched off within 12 s').toBeGreaterThan(0);
    expect(v.mode).toBe('home');
  });

  it('the computer teammate leaves a mess to the player standing next to it', () => {
    // Is the computer human heading for the mess after a short while?
    const run = (playerClose: boolean) => {
      const { g, step } = setup(true);
      const S = g.state;
      const mess = g.createMess('trash', 3.0, 3.6, {});
      place(S.chars[2], playerClose ? 3.0 : -12, playerClose ? 2.6 : 18, 0);
      place(S.chars[1], 0.5, 3.4, 0);
      place(g.tofu, -10, 18, 0);
      g.tofu.stun = 99;
      step(90);
      return { near: Math.hypot(S.chars[1].x - 3.0, S.chars[1].z - 3.6), progress: S.messes.find((m) => m.id === mess.id)?.progress ?? 99 };
    };
    const alone = run(false);
    expect(alone.near < 1.6 || alone.progress > 0, 'without the player, the computer cleans it').toBe(true);
    const shared = run(true);
    expect(shared.progress).toBe(0);
    expect(shared.near).toBeGreaterThan(1.6);
  });

  it('a mess fallen in a nook behind the armchair can still be cleaned', () => {
    const g = new Game({ seed: 3, duration: 360, players: [{ role: 'tofu', name: 'Tofu', avatar: 0, ai: true }, { role: 'human', name: 'Ordi', avatar: 0, ai: true }], noCountdown: true, difficulty: 1 });
    const p = g.world.humanNav.findPath(-6.5, -2, 5.6, 5.7, () => 0);
    expect(p).not.toBeNull();
    const end = p![p!.length - 1];
    const m = g.createMess('soil', 5.6, 5.7, {});
    const h = g.state.chars[1];
    place(h, end.x, end.z, 0);
    expect(listInteractions(g, h).some((i) => i.kind === 'clean' && i.target === m.id)).toBe(true);
  });
});
