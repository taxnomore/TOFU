import { describe, expect, it } from 'vitest';
import { Game } from '../src/shared/sim/game';
import { createAI } from '../src/shared/ai/ai';
import { SIM_HZ } from '../src/shared/constants';
import type { GameEvent, PlayerSlot } from '../src/shared/sim/types';
import { MASK_DOG, MASK_HUMAN } from '../src/shared/world/types';

function runMatch(humans: number, seed: number, duration = 240, difficulty = 1) {
  const players: PlayerSlot[] = [{ role: 'tofu', name: 'Tofu', avatar: 0, ai: true }];
  for (let i = 0; i < humans; i++) players.push({ role: 'human', name: `H${i}`, avatar: i, ai: true });
  const g = new Game({ seed, duration, players, noCountdown: true, difficulty });
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
