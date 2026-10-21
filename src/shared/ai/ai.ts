// AI factory. AI characters produce the same InputFrames as players, so they
// obey exactly the same rules (reach, cooldowns, collisions).
import { SIM_DT } from '../constants';
import { Rng } from '../math';
import type { Game } from '../sim/game';
import type { InputFrame } from '../sim/types';
import { HumanAI } from './humanAI';
import { TofuAI } from './tofuAI';

export interface AIController {
  think(): InputFrame;
}

/** Goals currently claimed by each AI human (to share the work). */
export type Claims = Map<number, string>;

const claimsByGame = new WeakMap<Game, Claims>();

export function createAI(g: Game, id: number, difficulty: number): AIController {
  const c = g.state.chars[id];
  const rng = new Rng((g.cfg.seed ^ (id * 2654435761)) >>> 0);
  let claims = claimsByGame.get(g);
  if (!claims) {
    claims = new Map();
    claimsByGame.set(g, claims);
  }
  const ai = c.role === 'tofu' ? new TofuAI(g, id, difficulty, rng) : new HumanAI(g, id, difficulty, claims, rng);
  ai.setDt(SIM_DT);
  return ai;
}
