// Derives static collision shapes from the map data and provides fast queries.
import { clamp } from '../math';
import { BUILDINGS, PROPS, WALLS, WALL_HEIGHT, WORLD_BOUNDS } from './map';
import { PROP_TYPES, propExtents } from './propTypes';
import {
  DoorDef, MASK_ALL, MASK_DOG, MASK_HUMAN, MASK_ITEM, MASK_SOLID, WallDef, WallStyle,
} from './types';

export interface Box {
  x0: number;
  z0: number;
  x1: number;
  z1: number;
  mask: number;
  /** Height of the obstacle (line of sight, camera, item landing). */
  h: number;
  tag: string;
}

export interface Circle {
  x: number;
  z: number;
  r: number;
  mask: number;
  h: number;
  tag: string;
}

export const WALL_STYLE: Record<WallStyle, { t: number; h: number }> = {
  house_ext: { t: 0.3, h: WALL_HEIGHT },
  house_int: { t: 0.14, h: WALL_HEIGHT },
  hedge: { t: 0.9, h: 1.8 },
  stone: { t: 0.35, h: 1.7 },
  fence: { t: 0.1, h: 1.2 },
  low_wall: { t: 0.3, h: 1.0 },
  facade: { t: 0.4, h: 6 },
  garden_fence: { t: 0.12, h: 1.3 },
};

export function wallThickness(w: WallDef): number {
  return w.thickness ?? WALL_STYLE[w.style].t;
}

export function wallHeight(w: WallDef): number {
  return w.height ?? WALL_STYLE[w.style].h;
}

/** Splits a wall into solid spans [a,b] along its length, given its openings. */
export function wallSpans(w: WallDef): { a: number; b: number; kind: 'solid' | 'doghole' }[] {
  const L = Math.hypot(w.x1 - w.x0, w.z1 - w.z0);
  const cuts = (w.openings ?? [])
    .filter((o) => o.kind !== 'window')
    .map((o) => ({ a: o.at - o.width / 2, b: o.at + o.width / 2, kind: o.kind }))
    .sort((p, q) => p.a - q.a);
  const spans: { a: number; b: number; kind: 'solid' | 'doghole' }[] = [];
  let cur = 0;
  for (const c of cuts) {
    if (c.a > cur) spans.push({ a: cur, b: c.a, kind: 'solid' });
    if (c.kind === 'doghole') spans.push({ a: c.a, b: c.b, kind: 'doghole' });
    cur = Math.max(cur, c.b);
  }
  if (cur < L) spans.push({ a: cur, b: L, kind: 'solid' });
  return spans;
}

/** Axis-aligned box for a span of a wall (the wall must be axis-aligned). */
export function wallSpanBox(w: WallDef, a: number, b: number, extendEnds: boolean): { x0: number; z0: number; x1: number; z1: number } {
  const t = wallThickness(w);
  const L = Math.hypot(w.x1 - w.x0, w.z1 - w.z0);
  const ux = (w.x1 - w.x0) / L;
  const uz = (w.z1 - w.z0) / L;
  const ext0 = extendEnds && a <= 1e-6 ? t / 2 : 0;
  const ext1 = extendEnds && b >= L - 1e-6 ? t / 2 : 0;
  const ax = w.x0 + ux * (a - ext0);
  const az = w.z0 + uz * (a - ext0);
  const bx = w.x0 + ux * (b + ext1);
  const bz = w.z0 + uz * (b + ext1);
  if (Math.abs(uz) < 1e-6) {
    return { x0: Math.min(ax, bx), x1: Math.max(ax, bx), z0: w.z0 - t / 2, z1: w.z0 + t / 2 };
  }
  return { x0: w.x0 - t / 2, x1: w.x0 + t / 2, z0: Math.min(az, bz), z1: Math.max(az, bz) };
}

/** Closed-door collider box. Mask depends on the door type (dog flap lets the dog and cat through). */
export function doorBox(d: DoorDef): Box {
  const t = d.kind === 'gate' ? 0.2 : 0.16;
  const hw = d.width / 2;
  const mask = d.dogFlap ? MASK_HUMAN | MASK_ITEM : MASK_SOLID;
  if (d.axis === 'x') {
    return { x0: d.x - hw, x1: d.x + hw, z0: d.z - t / 2, z1: d.z + t / 2, mask, h: 2.1, tag: 'door:' + d.id };
  }
  return { x0: d.x - t / 2, x1: d.x + t / 2, z0: d.z - hw, z1: d.z + hw, mask, h: 2.1, tag: 'door:' + d.id };
}

export class StaticColliders {
  boxes: Box[] = [];
  circles: Circle[] = [];
  readonly cell = 2;
  readonly gx0: number;
  readonly gz0: number;
  readonly gw: number;
  readonly gh: number;
  private boxCells: number[][] = [];
  private circleCells: number[][] = [];

  constructor() {
    this.gx0 = WORLD_BOUNDS.x0 - 2;
    this.gz0 = WORLD_BOUNDS.z0 - 10;
    this.gw = Math.ceil((WORLD_BOUNDS.x1 + 2 - this.gx0) / this.cell);
    this.gh = Math.ceil((WORLD_BOUNDS.z1 + 2 - this.gz0) / this.cell);
    this.build();
    this.index();
  }

  private build() {
    for (const w of WALLS) {
      const h = wallHeight(w);
      for (const s of wallSpans(w)) {
        const b = wallSpanBox(w, s.a, s.b, true);
        if (s.kind === 'solid') {
          this.boxes.push({ ...b, mask: MASK_ALL, h, tag: 'wall:' + w.id });
        } else {
          // Hedge hole: too small for humans, fine for the dog and the cat.
          this.boxes.push({ ...b, mask: MASK_HUMAN | MASK_ITEM, h: 0.6, tag: 'doghole:' + w.id });
        }
      }
    }
    for (const bd of BUILDINGS) {
      this.boxes.push({ x0: bd.x0, z0: bd.z0, x1: bd.x1, z1: bd.z1, mask: MASK_ALL, h: 3 * bd.storeys, tag: 'building:' + bd.id });
    }
    for (const p of PROPS) {
      const t = PROP_TYPES[p.type];
      if (t.col === 'none' || t.mask === 0) continue;
      if (t.col === 'circle') {
        this.circles.push({ x: p.x, z: p.z, r: t.r ?? Math.min(t.w, t.d) / 2, mask: t.mask, h: p.h ?? t.h, tag: 'prop:' + p.type });
      } else {
        const e = propExtents(p);
        const ins = t.inset ?? 0;
        this.boxes.push({
          x0: p.x - e.hw + ins, x1: p.x + e.hw - ins, z0: p.z - e.hd + ins, z1: p.z + e.hd - ins,
          mask: t.mask, h: e.h, tag: 'prop:' + p.type,
        });
      }
    }
    // Outer bounds: thick invisible walls far outside the natural boundaries (safety net only).
    const B = WORLD_BOUNDS;
    const T = 2;
    this.boxes.push({ x0: B.x0 - T, x1: B.x1 + T, z0: B.z0 - T, z1: B.z0, mask: MASK_ALL, h: 3, tag: 'bounds' });
    this.boxes.push({ x0: B.x0 - T, x1: B.x1 + T, z0: B.z1, z1: B.z1 + T, mask: MASK_ALL, h: 3, tag: 'bounds' });
    this.boxes.push({ x0: B.x0 - T, x1: B.x0, z0: B.z0, z1: B.z1, mask: MASK_ALL, h: 3, tag: 'bounds' });
    this.boxes.push({ x0: B.x1, x1: B.x1 + T, z0: B.z0, z1: B.z1, mask: MASK_ALL, h: 3, tag: 'bounds' });
  }

  private cellIndex(cx: number, cz: number): number {
    return cz * this.gw + cx;
  }

  private index() {
    const n = this.gw * this.gh;
    this.boxCells = Array.from({ length: n }, () => []);
    this.circleCells = Array.from({ length: n }, () => []);
    this.boxes.forEach((b, i) => {
      this.forCells(b.x0, b.z0, b.x1, b.z1, (ci) => this.boxCells[ci].push(i));
    });
    this.circles.forEach((c, i) => {
      this.forCells(c.x - c.r, c.z - c.r, c.x + c.r, c.z + c.r, (ci) => this.circleCells[ci].push(i));
    });
  }

  private forCells(x0: number, z0: number, x1: number, z1: number, fn: (ci: number) => void) {
    const cx0 = clamp(Math.floor((x0 - this.gx0) / this.cell), 0, this.gw - 1);
    const cx1 = clamp(Math.floor((x1 - this.gx0) / this.cell), 0, this.gw - 1);
    const cz0 = clamp(Math.floor((z0 - this.gz0) / this.cell), 0, this.gh - 1);
    const cz1 = clamp(Math.floor((z1 - this.gz0) / this.cell), 0, this.gh - 1);
    for (let cz = cz0; cz <= cz1; cz++) for (let cx = cx0; cx <= cx1; cx++) fn(this.cellIndex(cx, cz));
  }

  private stamp = 1;
  private boxStamp: Uint32Array | null = null;
  private circleStamp: Uint32Array | null = null;

  /** Calls fn for every collider whose bounds overlap the query rectangle (deduplicated). */
  query(x0: number, z0: number, x1: number, z1: number, onBox: (b: Box) => void, onCircle?: (c: Circle) => void) {
    if (!this.boxStamp || this.boxStamp.length !== this.boxes.length) this.boxStamp = new Uint32Array(this.boxes.length);
    if (!this.circleStamp || this.circleStamp.length !== this.circles.length) this.circleStamp = new Uint32Array(this.circles.length);
    const st = ++this.stamp;
    const bs = this.boxStamp;
    const cs = this.circleStamp;
    this.forCells(x0, z0, x1, z1, (ci) => {
      for (const i of this.boxCells[ci]) {
        if (bs[i] === st) continue;
        bs[i] = st;
        const b = this.boxes[i];
        if (b.x1 < x0 || b.x0 > x1 || b.z1 < z0 || b.z0 > z1) continue;
        onBox(b);
      }
      if (onCircle) {
        for (const i of this.circleCells[ci]) {
          if (cs[i] === st) continue;
          cs[i] = st;
          const c = this.circles[i];
          if (c.x + c.r < x0 || c.x - c.r > x1 || c.z + c.r < z0 || c.z - c.r > z1) continue;
          onCircle(c);
        }
      }
    });
  }

  /** True if a circle at (x,z) of radius r overlaps any static collider matching mask. */
  overlaps(x: number, z: number, r: number, mask: number): boolean {
    let hit = false;
    this.query(x - r, z - r, x + r, z + r, (b) => {
      if (hit || !(b.mask & mask)) return;
      if (circleBoxPenetration(x, z, r, b) > 0) hit = true;
    }, (c) => {
      if (hit || !(c.mask & mask)) return;
      const dx = x - c.x;
      const dz = z - c.z;
      if (dx * dx + dz * dz < (r + c.r) * (r + c.r)) hit = true;
    });
    return hit;
  }
}

/** Returns penetration depth (>0 when overlapping) of a circle against a box. */
export function circleBoxPenetration(x: number, z: number, r: number, b: { x0: number; z0: number; x1: number; z1: number }): number {
  const cx = clamp(x, b.x0, b.x1);
  const cz = clamp(z, b.z0, b.z1);
  const dx = x - cx;
  const dz = z - cz;
  const d2 = dx * dx + dz * dz;
  if (d2 >= r * r) return 0;
  if (d2 > 1e-10) return r - Math.sqrt(d2);
  // Center inside the box.
  const inside = Math.min(x - b.x0, b.x1 - x, z - b.z0, b.z1 - z);
  return r + inside;
}

/**
 * Pushes a circle out of a box. Returns the push applied (0 if none).
 * Writes the corrected position into out.
 */
export function pushOutOfBox(x: number, z: number, r: number, b: { x0: number; z0: number; x1: number; z1: number }, out: { x: number; z: number; nx: number; nz: number }): boolean {
  const cx = clamp(x, b.x0, b.x1);
  const cz = clamp(z, b.z0, b.z1);
  let dx = x - cx;
  let dz = z - cz;
  const d2 = dx * dx + dz * dz;
  if (d2 >= r * r) return false;
  if (d2 > 1e-10) {
    const d = Math.sqrt(d2);
    dx /= d;
    dz /= d;
    const push = r - d;
    out.x = x + dx * push;
    out.z = z + dz * push;
    out.nx = dx;
    out.nz = dz;
    return true;
  }
  // Center inside: push along the axis of least penetration.
  const l = x - b.x0;
  const rr = b.x1 - x;
  const t = z - b.z0;
  const bt = b.z1 - z;
  const m = Math.min(l, rr, t, bt);
  out.x = x;
  out.z = z;
  out.nx = 0;
  out.nz = 0;
  if (m === l) { out.x = b.x0 - r; out.nx = -1; }
  else if (m === rr) { out.x = b.x1 + r; out.nx = 1; }
  else if (m === t) { out.z = b.z0 - r; out.nz = -1; }
  else { out.z = b.z1 + r; out.nz = 1; }
  return true;
}

export { MASK_DOG, MASK_HUMAN, MASK_ITEM };
