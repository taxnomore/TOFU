// Small math helpers shared by simulation, AI and client.
// No DOM / Three.js dependencies here: this code also runs on the Node server.

export const TAU = Math.PI * 2;

export function clamp(v: number, lo: number, hi: number): number {
  return v < lo ? lo : v > hi ? hi : v;
}

export function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

/** Wraps an angle to [-PI, PI). */
export function wrapAngle(a: number): number {
  a = (a + Math.PI) % TAU;
  if (a < 0) a += TAU;
  return a - Math.PI;
}

/** Shortest signed difference b - a between two angles. */
export function angleDiff(a: number, b: number): number {
  return wrapAngle(b - a);
}

export function lerpAngle(a: number, b: number, t: number): number {
  return a + angleDiff(a, b) * t;
}

/** Moves angle a toward b by at most maxStep radians. */
export function approachAngle(a: number, b: number, maxStep: number): number {
  const d = angleDiff(a, b);
  if (Math.abs(d) <= maxStep) return b;
  return a + Math.sign(d) * maxStep;
}

export function approach(v: number, target: number, maxStep: number): number {
  if (v < target) return Math.min(v + maxStep, target);
  return Math.max(v - maxStep, target);
}

export function dist2(ax: number, az: number, bx: number, bz: number): number {
  const dx = ax - bx;
  const dz = az - bz;
  return dx * dx + dz * dz;
}

export function dist(ax: number, az: number, bx: number, bz: number): number {
  return Math.sqrt(dist2(ax, az, bx, bz));
}

export function len(x: number, z: number): number {
  return Math.sqrt(x * x + z * z);
}

/** Heading angle convention: facing = atan2(dx, dz) so facing 0 looks toward +z. */
export function headingOf(dx: number, dz: number): number {
  return Math.atan2(dx, dz);
}

export function smoothstep(e0: number, e1: number, x: number): number {
  const t = clamp((x - e0) / (e1 - e0), 0, 1);
  return t * t * (3 - 2 * t);
}

/** Exponential smoothing factor independent of frame rate. */
export function damp(rate: number, dt: number): number {
  return 1 - Math.exp(-rate * dt);
}

/** Deterministic PRNG (mulberry32). State is a single uint32 so it serializes easily. */
export class Rng {
  state: number;
  constructor(seed: number) {
    this.state = seed >>> 0 || 0x9e3779b9;
  }
  next(): number {
    let t = (this.state = (this.state + 0x6d2b79f5) >>> 0);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }
  range(lo: number, hi: number): number {
    return lo + (hi - lo) * this.next();
  }
  int(lo: number, hiInclusive: number): number {
    return lo + Math.floor(this.next() * (hiInclusive - lo + 1));
  }
  pick<T>(arr: readonly T[]): T {
    return arr[Math.floor(this.next() * arr.length)];
  }
  chance(p: number): boolean {
    return this.next() < p;
  }
  shuffle<T>(arr: T[]): T[] {
    for (let i = arr.length - 1; i > 0; i--) {
      const j = Math.floor(this.next() * (i + 1));
      const tmp = arr[i];
      arr[i] = arr[j];
      arr[j] = tmp;
    }
    return arr;
  }
}

/** Closest point on segment AB to P, returned as parameter t in [0,1]. */
export function segmentT(ax: number, az: number, bx: number, bz: number, px: number, pz: number): number {
  const abx = bx - ax;
  const abz = bz - az;
  const l2 = abx * abx + abz * abz;
  if (l2 < 1e-9) return 0;
  return clamp(((px - ax) * abx + (pz - az) * abz) / l2, 0, 1);
}

export function distToSegment(ax: number, az: number, bx: number, bz: number, px: number, pz: number): number {
  const t = segmentT(ax, az, bx, bz, px, pz);
  return dist(ax + (bx - ax) * t, az + (bz - az) * t, px, pz);
}
