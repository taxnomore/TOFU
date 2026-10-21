import { Game } from '../src/shared/sim/game';
import type { Character, GameConfig, InputFrame } from '../src/shared/sim/types';
import { BTN_INTERACT } from '../src/shared/constants';

export function makeGame(over: Partial<GameConfig> = {}, humans = 1): Game {
  const players: GameConfig['players'] = [{ role: 'tofu', name: 'Tofu', avatar: 0, ai: false }];
  for (let i = 0; i < humans; i++) players.push({ role: 'human', name: `H${i + 1}`, avatar: i, ai: false });
  return new Game({ seed: 42, duration: 360, players, noCountdown: true, ...over });
}

export function place(c: Character, x: number, z: number, facing = c.facing) {
  c.x = x;
  c.z = z;
  c.vx = c.vz = 0;
  c.facing = facing;
}

export function steps(g: Game, n: number, inputs: (InputFrame | undefined)[] = []) {
  for (let i = 0; i < n; i++) g.step(inputs);
}

/** Press and release a button for one character. */
export function press(g: Game, id: number, button = BTN_INTERACT) {
  const inp: (InputFrame | undefined)[] = [];
  inp[id] = { mx: 0, mz: 0, buttons: button };
  g.step(inp);
  inp[id] = { mx: 0, mz: 0, buttons: 0 };
  g.step(inp);
}

/** Hold a button for a duration (seconds). */
export function hold(g: Game, id: number, seconds: number, button = BTN_INTERACT) {
  const inp: (InputFrame | undefined)[] = [];
  inp[id] = { mx: 0, mz: 0, buttons: button };
  steps(g, Math.ceil(seconds * 60), inp);
  inp[id] = { mx: 0, mz: 0, buttons: 0 };
  g.step(inp);
}

/** Walk a character toward a point for a duration. */
export function walk(g: Game, id: number, dx: number, dz: number, seconds: number, buttons = 0) {
  const inp: (InputFrame | undefined)[] = [];
  inp[id] = { mx: dx, mz: dz, buttons };
  steps(g, Math.ceil(seconds * 60), inp);
}

/** Facing angle looking from (x,z) to (tx,tz). */
export function faceTo(x: number, z: number, tx: number, tz: number) {
  return Math.atan2(tx - x, tz - z);
}
