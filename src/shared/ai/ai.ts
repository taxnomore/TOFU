// AI entry point (placeholder replaced by the full AI in the AI milestone).
import type { Game } from '../sim/game';
import { EMPTY_INPUT, InputFrame } from '../sim/types';

export interface AIController {
  think(): InputFrame;
}

export function createAI(_g: Game, _id: number, _difficulty: number): AIController {
  return { think: () => EMPTY_INPUT };
}
