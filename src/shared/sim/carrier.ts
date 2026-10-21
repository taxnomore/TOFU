// "La factrice": a lightweight scripted NPC walking along the south sidewalk.
// Tofu can bark at her for chaos points. No collisions, no pathfinding needed.
import { CHAOS } from '../constants';
import { dist } from '../math';
import type { Game } from './game';
import type { CarrierState } from './types';

const PATH_Z = -14.45;
const START_X = -29.6;
const END_X = 32.2;
const STOP_X = 5.3;

export function initialCarrier(): CarrierState {
  return { active: false, x: START_X, z: PATH_Z, facing: Math.PI / 2, t: 0, wait: 0, barkCd: 0, scared: 0, next: 30 };
}

export function updateCarrier(g: Game, dt: number): void {
  const c = g.state.carrier;
  if (!c.active) {
    if (g.state.phase !== 'play') return;
    c.next -= dt;
    if (c.next <= 0) {
      c.active = true;
      c.x = START_X;
      c.z = PATH_Z;
      c.facing = Math.PI / 2;
      c.wait = 0;
      c.t = 0;
      g.emit({ t: 'carrier', what: 'arrive' });
    }
    return;
  }
  c.t += dt;
  c.barkCd = Math.max(0, c.barkCd - dt);
  c.scared = Math.max(0, c.scared - dt);
  if (c.wait > 0) {
    c.wait -= dt;
    return;
  }
  const speed = c.scared > 0 ? 3.4 : 1.35;
  const prev = c.x;
  c.x += speed * dt;
  if (prev < STOP_X && c.x >= STOP_X) c.wait = 2.5;
  if (c.x > END_X) {
    c.active = false;
    c.next = 75 + g.rng.next() * 35;
    g.emit({ t: 'carrier', what: 'leave' });
  }
}

/** Called when Tofu barks. Returns true if the carrier was startled. */
export function carrierHearsBark(g: Game): boolean {
  const c = g.state.carrier;
  if (!c.active) return false;
  const tofu = g.tofu;
  if (dist(c.x, c.z, tofu.x, tofu.z) > 7.5) return false;
  if (c.barkCd > 0) return false;
  c.barkCd = 8;
  c.scared = 2.5;
  c.wait = 0;
  g.addChaos(CHAOS.barkCarrier, 'La factrice a eu peur !', c.x, c.z);
  g.progressSecret('facteur', 1);
  g.emit({ t: 'carrier', what: 'scared' });
  return true;
}
