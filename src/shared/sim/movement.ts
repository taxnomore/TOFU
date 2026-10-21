// Character movement and collision. Pure functions so the client can reuse them
// for local prediction of its own character in network games.
import { approachAngle, clamp } from '../math';
import { pushOutOfBox } from '../world/colliders';
import { ITEM_TYPES } from '../world/itemTypes';
import { MASK_DOG, MASK_HUMAN } from '../world/types';
import { BTN_SIT, BTN_SPRINT, DOG, HUMAN } from '../constants';
import type { World } from './world';
import { Anim } from './types';
import type { Character, DoorState, InputFrame, Item } from './types';

export interface MoveContext {
  world: World;
  doors: DoorState[];
  items: Item[];
}

export function charRadius(c: { role: string }): number {
  return c.role === 'tofu' ? DOG.radius : HUMAN.radius;
}

export function charMask(c: { role: string }): number {
  return c.role === 'tofu' ? MASK_DOG : MASK_HUMAN;
}

/** Collider radius and mask of a standing knockable, or null if it does not block. */
export function knockableCollider(it: Item): { r: number; mask: number } | null {
  if (it.state !== 'home' || it.y > 0.1) return null;
  const t = ITEM_TYPES[it.type];
  if (!t.knock) return null;
  if (t.knock.push > 0) return { r: t.size, mask: MASK_HUMAN | MASK_DOG };
  return { r: t.size * 0.9, mask: MASK_HUMAN };
}

const tmp = { x: 0, z: 0, nx: 0, nz: 0 };

/**
 * Pushes a circle out of every blocking collider. Velocity (if provided) loses
 * its component into the contact normals, which gives smooth wall sliding.
 */
export function resolveCircle(
  ctx: MoveContext, pos: { x: number; z: number }, r: number, mask: number, vel?: { vx: number; vz: number },
): boolean {
  let hitAny = false;
  for (let iter = 0; iter < 4; iter++) {
    let hit = false;
    const apply = () => {
      pos.x = tmp.x;
      pos.z = tmp.z;
      hit = true;
      if (vel) {
        const vn = vel.vx * tmp.nx + vel.vz * tmp.nz;
        if (vn < 0) {
          vel.vx -= vn * tmp.nx;
          vel.vz -= vn * tmp.nz;
        }
      }
    };
    ctx.world.cols.query(pos.x - r, pos.z - r, pos.x + r, pos.z + r, (b) => {
      if (!(b.mask & mask)) return;
      if (pushOutOfBox(pos.x, pos.z, r, b, tmp)) apply();
    }, (c) => {
      if (!(c.mask & mask)) return;
      const dx = pos.x - c.x;
      const dz = pos.z - c.z;
      const d2 = dx * dx + dz * dz;
      const rr = r + c.r;
      if (d2 >= rr * rr) return;
      const d = Math.sqrt(d2) || 1e-4;
      tmp.nx = dx / d;
      tmp.nz = dz / d;
      tmp.x = c.x + tmp.nx * rr;
      tmp.z = c.z + tmp.nz * rr;
      apply();
    });
    for (let i = 0; i < ctx.doors.length; i++) {
      if (ctx.doors[i].open) continue;
      const b = ctx.world.doorBoxes[i];
      if (!(b.mask & mask)) continue;
      if (pos.x + r < b.x0 || pos.x - r > b.x1 || pos.z + r < b.z0 || pos.z - r > b.z1) continue;
      if (pushOutOfBox(pos.x, pos.z, r, b, tmp)) apply();
    }
    for (const it of ctx.items) {
      const kc = knockableCollider(it);
      if (!kc || !(kc.mask & mask)) continue;
      const dx = pos.x - it.x;
      const dz = pos.z - it.z;
      const rr = r + kc.r;
      const d2 = dx * dx + dz * dz;
      if (d2 >= rr * rr) continue;
      const d = Math.sqrt(d2) || 1e-4;
      tmp.nx = dx / d;
      tmp.nz = dz / d;
      tmp.x = it.x + tmp.nx * rr;
      tmp.z = it.z + tmp.nz * rr;
      apply();
    }
    if (!hit) break;
    hitAny = true;
  }
  return hitAny;
}

/**
 * Integrates one movement step for a character.
 * (dx, dz): desired direction with magnitude in [0,1]. maxSpeed in m/s.
 */
export function moveCharacter(
  c: Character, dx: number, dz: number, maxSpeed: number, dt: number, ctx: MoveContext, faceInput = true,
): void {
  const accel = c.role === 'tofu' ? DOG.accel : HUMAN.accel;
  const turn = c.role === 'tofu' ? DOG.turn : HUMAN.turn;
  const mag = Math.min(1, Math.hypot(dx, dz));
  const tvx = mag > 1e-3 ? (dx / Math.hypot(dx, dz)) * mag * maxSpeed : 0;
  const tvz = mag > 1e-3 ? (dz / Math.hypot(dx, dz)) * mag * maxSpeed : 0;
  let dvx = tvx - c.vx;
  let dvz = tvz - c.vz;
  const dl = Math.hypot(dvx, dvz);
  const maxDv = accel * dt;
  if (dl > maxDv) {
    dvx *= maxDv / dl;
    dvz *= maxDv / dl;
  }
  c.vx += dvx;
  c.vz += dvz;
  const ox = c.x;
  const oz = c.z;
  const pos = { x: c.x + c.vx * dt, z: c.z + c.vz * dt };
  const vel = { vx: c.vx, vz: c.vz };
  resolveCircle(ctx, pos, charRadius(c), charMask(c), vel);
  c.x = pos.x;
  c.z = pos.z;
  c.vx = vel.vx;
  c.vz = vel.vz;
  c.speed = Math.hypot(c.x - ox, c.z - oz) / dt;
  if (faceInput && mag > 0.15) {
    c.facing = approachAngle(c.facing, Math.atan2(dx, dz), turn * dt);
  } else if (!faceInput && c.speed > 0.3) {
    c.facing = approachAngle(c.facing, Math.atan2(c.vx, c.vz), turn * dt);
  }
}

/** Separates overlapping characters (soft bodies). */
export function separateCharacters(chars: Character[], ctx: MoveContext): void {
  for (let i = 0; i < chars.length; i++) {
    for (let j = i + 1; j < chars.length; j++) {
      const a = chars[i];
      const b = chars[j];
      const ra = charRadius(a);
      const rb = charRadius(b);
      const dx = b.x - a.x;
      const dz = b.z - a.z;
      const d2 = dx * dx + dz * dz;
      const rr = ra + rb;
      if (d2 >= rr * rr) continue;
      const d = Math.sqrt(d2) || 1e-3;
      const push = (rr - d) / 2;
      const nx = d2 > 1e-8 ? dx / d : 1;
      const nz = d2 > 1e-8 ? dz / d : 0;
      a.x -= nx * push;
      a.z -= nz * push;
      b.x += nx * push;
      b.z += nz * push;
      const pa = { x: a.x, z: a.z };
      resolveCircle(ctx, pa, ra, charMask(a));
      a.x = pa.x;
      a.z = pa.z;
      const pb = { x: b.x, z: b.z };
      resolveCircle(ctx, pb, rb, charMask(b));
      b.x = pb.x;
      b.z = pb.z;
    }
  }
}

export function clampToWorld(p: { x: number; z: number }, b: { x0: number; z0: number; x1: number; z1: number }) {
  p.x = clamp(p.x, b.x0 + 0.3, b.x1 - 0.3);
  p.z = clamp(p.z, b.z0 + 0.3, b.z1 - 0.3);
}

/**
 * Movement part of a character update: sprint/stamina, speed modifiers and
 * collision-aware integration. Returns whether the dog is sitting.
 * Used by the simulation and by the client to predict its own character.
 */
export function applyMovement(c: Character, inp: InputFrame, dt: number, ctx: MoveContext): boolean {
  const isDog = c.role === 'tofu';
  let mx = inp.mx;
  let mz = inp.mz;
  const ml = Math.hypot(mx, mz);
  if (ml > 1) {
    mx /= ml;
    mz /= ml;
  }
  if (c.act || (c.lockT > 0 && (c.anim === Anim.Eat || c.anim === Anim.Jump))) {
    mx = 0;
    mz = 0;
  }
  const moving = Math.hypot(mx, mz) > 0.2;
  const sitting = isDog && !moving && !c.act && ((inp.buttons & BTN_SIT) !== 0 || c.idleT > DOG.idleSitDelay);
  const wantSprint = (inp.buttons & BTN_SPRINT) !== 0 && moving;
  const st = isDog ? DOG : HUMAN;
  if (wantSprint && !c.exhausted && (c.sprinting || c.stamina > st.staminaMinStart) && c.zoomT <= 0) {
    c.sprinting = true;
    c.stamina -= st.staminaDrain * dt;
    if (c.stamina <= 0) {
      c.stamina = 0;
      c.exhausted = true;
      c.sprinting = false;
    }
  } else {
    c.sprinting = false;
    const mul = sitting ? DOG.sitRegenMul : 1;
    c.stamina = Math.min(1, c.stamina + st.staminaRegen * mul * dt);
    if (c.exhausted && c.stamina > 0.35) c.exhausted = false;
  }
  let maxSpeed: number;
  if (isDog) {
    maxSpeed = c.zoomT > 0 ? DOG.zoomies : c.sprinting ? DOG.sprint : DOG.walk;
    if (c.hold.length) maxSpeed *= 1 - DOG.carrySlow;
    if (c.pantT > 0) maxSpeed *= 0.75;
  } else {
    maxSpeed = c.sprinting ? HUMAN.sprint : HUMAN.walk;
    let slow = 0;
    for (const i of c.hold) slow += ITEM_TYPES[ctx.items[i].type].carry?.slow ?? 0;
    maxSpeed *= 1 - Math.min(0.2, slow);
  }
  if (c.zoomT > 0 && moving) {
    // Zoomies: always full speed in the stick direction.
    const l = Math.hypot(mx, mz);
    mx /= l;
    mz /= l;
  }
  moveCharacter(c, mx, mz, maxSpeed, dt, ctx);
  if (moving || c.act) c.idleT = 0;
  else c.idleT += dt;
  if (isDog) {
    if (sitting) c.sitT += dt;
    else c.sitT = 0;
  }
  return sitting;
}
