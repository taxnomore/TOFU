// Computer players on every place: no crash, Tofu makes mischief and the
// humans get jobs done, in every ambiance offered there.
import { describe, expect, it } from 'vitest';
import { createAI } from '../src/shared/ai/ai';
import { SIM_HZ } from '../src/shared/constants';
import { Game } from '../src/shared/sim/game';
import { MAP_LIST } from '../src/shared/world/maps';

const CASES = MAP_LIST.flatMap((m) => m.variants.map((v) => [m.id, v] as const));

describe.each(CASES)('computer players on %s (%s)', (map, variant) => {
  it('play a lively round', () => {
    const g = new Game({
      seed: 7, duration: 300, noCountdown: true, difficulty: 1, map, variant,
      players: [
        { role: 'tofu', name: 'Tofu', avatar: 0, ai: true },
        { role: 'human', name: 'A', avatar: 0, ai: true },
        { role: 'human', name: 'B', avatar: 1, ai: true },
      ],
    });
    const ais = g.state.chars.map((c) => createAI(g, c.id, 1));
    let doneOnce = 0;
    for (let tick = 0; tick < 120 * SIM_HZ && g.state.phase !== 'end'; tick++) {
      g.step(ais.map((a) => a.think()));
      for (const e of g.drainEvents()) if (e.t === 'task' && e.done) doneOnce++;
    }
    expect(g.state.chaos).toBeGreaterThan(15);
    expect(doneOnce).toBeGreaterThanOrEqual(2);
  });
});
