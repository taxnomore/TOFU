// "L'aspirateur robot": a small autonomous vacuum in the living room. Tofu (or a
// human) switches it on; it wanders, bounces off furniture, knocks small things
// over, scares the cat and sucks up mud prints, paper strips and crumbs.
import { CHAOS, VACUUM } from '../constants';
import { approachAngle, dist } from '../math';
import { ITEM_TYPES, MESS_TYPES } from '../world/itemTypes';
import { MASK_DOG, MASK_ITEM } from '../world/types';
import { scareCat } from './cat';
import type { Game } from './game';
import { resolveCircle } from './movement';
import type { Character, VacuumState } from './types';

/** Knock attribution for the vacuum (see Game.knock). */
export const VACUUM_KNOCK = -4;

/** Low and flat: it rolls under tables like Tofu, but no dog flap for it. */
const MASK = MASK_DOG | MASK_ITEM;

export function initialVacuum(): VacuumState {
  const d = VACUUM.dock;
  return { mode: 'dock', x: d.x, z: d.z, facing: d.facing, t: 0, turnT: 0, by: -1 };
}

/** Switches the vacuum on (from its dock) or sends it back home. */
export function switchVacuum(g: Game, c: Character): void {
  const v = g.state.vacuum;
  if (v.mode === 'dock') {
    if (v.t > 0) return; // still charging
    v.mode = 'run';
    v.t = VACUUM.runTime;
    v.turnT = 0.8;
    v.by = c.id;
    if (c.role === 'tofu') {
      g.addChaos(CHAOS.vacuum, 'Vrrrrr !', v.x, v.z);
      g.addZoom(c, 'vacuum');
    }
    g.emit({ t: 'vacuum', on: true, by: c.id, x: v.x, z: v.z });
  } else if (v.mode === 'run') {
    v.mode = 'home';
    v.t = VACUUM.homeTime;
    g.emit({ t: 'vacuum', on: false, by: c.id, x: v.x, z: v.z });
  }
}

function dock(g: Game, v: VacuumState) {
  const d = VACUUM.dock;
  v.mode = 'dock';
  v.x = d.x;
  v.z = d.z;
  v.facing = d.facing;
  v.t = VACUUM.rest;
  v.by = -1;
}

export function updateVacuum(g: Game, dt: number): void {
  const S = g.state;
  const v = S.vacuum;
  if (v.mode === 'dock') {
    v.t = Math.max(0, v.t - dt);
    return;
  }
  v.t -= dt;
  if (v.mode === 'run' && v.t <= 0) {
    v.mode = 'home';
    v.t = VACUUM.homeTime;
    g.emit({ t: 'vacuum', on: false, by: -1, x: v.x, z: v.z });
  }
  if (v.mode === 'home') {
    const d = VACUUM.dock;
    const dd = dist(v.x, v.z, d.x, d.z);
    // Back on its dock, or teleported there if furniture keeps it away too long.
    if (dd < 0.25 || v.t <= 0) {
      dock(g, v);
      return;
    }
    v.turnT -= dt;
    if (v.turnT <= 0) v.facing = approachAngle(v.facing, Math.atan2(d.x - v.x, d.z - v.z), 3 * dt);
  } else {
    v.turnT -= dt;
    if (v.turnT <= 0) {
      v.turnT = 1.5 + g.rng.next() * 2.5;
      v.facing += (g.rng.next() - 0.5) * 1.4;
    }
  }
  const pos = { x: v.x + Math.sin(v.facing) * VACUUM.speed * dt, z: v.z + Math.cos(v.facing) * VACUUM.speed * dt };
  if (resolveCircle(g.ctx, pos, VACUUM.radius, MASK)) {
    // Bumped into something: turn away like a real one.
    v.facing += (Math.PI * 0.5 + g.rng.next() * Math.PI * 0.6) * (g.rng.next() < 0.5 ? -1 : 1);
    v.turnT = v.mode === 'home' ? 0.6 : 1 + g.rng.next();
  }
  v.x = pos.x;
  v.z = pos.z;

  // Knocks small things standing on the floor (an accident, like the cat's).
  const by = VACUUM_KNOCK;
  for (const it of S.items) {
    if (it.state !== 'home' || it.knockCd > 0 || it.y > 0.3) continue;
    const t = ITEM_TYPES[it.type];
    if (!t.knock || t.knock.push > 0) continue;
    if (dist(it.x, it.z, v.x, v.z) < VACUUM.radius + t.size * 0.6) {
      g.knock(it.idx, Math.sin(v.facing), Math.cos(v.facing), 2.5, by);
    }
  }

  // Sucks up prints, paper and crumbs on its way.
  for (const m of [...S.messes]) {
    if (m.kind !== 'mud' && m.kind !== 'paper' && m.kind !== 'crumbs') continue;
    if (dist(m.x, m.z, v.x, v.z) > m.r + 0.6) continue;
    if (m.kind === 'crumbs') {
      if (dist(m.x, m.z, v.x, v.z) < m.r) {
        m.progress += dt;
        g.touchMess(m);
        if (m.progress >= MESS_TYPES.crumbs.clean * 1.5) g.removeMess(m.id, -1);
      }
      continue;
    }
    let removed = false;
    for (let i = m.prints.length - 3; i >= 0; i -= 3) {
      if (Math.hypot(m.prints[i] - v.x, m.prints[i + 1] - v.z) < 0.3) {
        m.prints.splice(i, 3);
        removed = true;
      }
    }
    if (!removed) continue;
    if (m.prints.length) g.touchMess(m);
    else g.removeMess(m.id, -1);
  }

  // The cat hates it.
  if (dist(S.cat.x, S.cat.z, v.x, v.z) < VACUUM.catFear) scareCat(g);
}
