// Grid navigation (A* + string pulling) for AI agents. Built from static colliders,
// with closed doors handled dynamically through a per-door cost callback.
import { DOORS, WORLD_BOUNDS } from './map';
import { StaticColliders, doorBox } from './colliders';
import { ITEMS } from './map';
import { ITEM_TYPES } from './itemTypes';

export interface PathPoint {
  x: number;
  z: number;
}

/** Extra cost to cross a closed door (Infinity = impassable). 0 means open. */
export type DoorCostFn = (doorIndex: number) => number;

const OX = [1, -1, 0, 0, 1, 1, -1, -1];
const OZ = [0, 0, 1, -1, 1, -1, 1, -1];

class MinHeap {
  private keys: number[] = [];
  private vals: number[] = [];
  get size() {
    return this.keys.length;
  }
  push(v: number, k: number) {
    const keys = this.keys;
    const vals = this.vals;
    let i = keys.length;
    keys.push(k);
    vals.push(v);
    while (i > 0) {
      const p = (i - 1) >> 1;
      if (keys[p] <= k) break;
      keys[i] = keys[p];
      vals[i] = vals[p];
      i = p;
    }
    keys[i] = k;
    vals[i] = v;
  }
  pop(): number {
    const keys = this.keys;
    const vals = this.vals;
    const top = vals[0];
    const lk = keys.pop()!;
    const lv = vals.pop()!;
    const n = keys.length;
    if (n > 0) {
      let i = 0;
      while (true) {
        const l = 2 * i + 1;
        if (l >= n) break;
        const r = l + 1;
        const c = r < n && keys[r] < keys[l] ? r : l;
        if (keys[c] >= lk) break;
        keys[i] = keys[c];
        vals[i] = vals[c];
        i = c;
      }
      keys[i] = lk;
      vals[i] = lv;
    }
    return top;
  }
  clear() {
    this.keys.length = 0;
    this.vals.length = 0;
  }
}

export class NavGrid {
  readonly cell = 0.5;
  readonly x0: number;
  readonly z0: number;
  readonly w: number;
  readonly h: number;
  /** 1 = blocked for this agent. */
  readonly blocked: Uint8Array;
  /** Door index occupying the cell, or -1. */
  readonly doorAt: Int16Array;
  /** Connected component id of free cells (computed with all doors open). */
  readonly comp: Int32Array;

  private g: Float32Array;
  private parent: Int32Array;
  private closed: Uint32Array;
  private seen: Uint32Array;
  private gen = 1;
  private heap = new MinHeap();

  constructor(cols: StaticColliders, readonly mask: number, readonly radius: number) {
    this.x0 = WORLD_BOUNDS.x0;
    this.z0 = WORLD_BOUNDS.z0;
    this.w = Math.ceil((WORLD_BOUNDS.x1 - WORLD_BOUNDS.x0) / this.cell);
    this.h = Math.ceil((WORLD_BOUNDS.z1 - WORLD_BOUNDS.z0) / this.cell);
    const n = this.w * this.h;
    this.blocked = new Uint8Array(n);
    this.doorAt = new Int16Array(n).fill(-1);
    this.comp = new Int32Array(n).fill(-1);
    this.g = new Float32Array(n);
    this.parent = new Int32Array(n);
    this.closed = new Uint32Array(n);
    this.seen = new Uint32Array(n);

    // Standing knockables with colliders are treated as permanent soft obstacles.
    const knockSpots: { x: number; z: number; r: number }[] = [];
    for (const it of ITEMS) {
      const t = ITEM_TYPES[it.type];
      if (t.knock && (it.y ?? 0) < 0.1 && it.x !== undefined && it.z !== undefined) {
        knockSpots.push({ x: it.x, z: it.z, r: t.size });
      }
    }

    const r = radius;
    for (let cz = 0; cz < this.h; cz++) {
      for (let cx = 0; cx < this.w; cx++) {
        const x = this.x0 + (cx + 0.5) * this.cell;
        const z = this.z0 + (cz + 0.5) * this.cell;
        let b = cols.overlaps(x, z, r, mask);
        if (!b) {
          for (const k of knockSpots) {
            const dx = x - k.x;
            const dz = z - k.z;
            if (dx * dx + dz * dz < (k.r + r) * (k.r + r)) {
              b = true;
              break;
            }
          }
        }
        this.blocked[cz * this.w + cx] = b ? 1 : 0;
      }
    }
    // Door cells.
    DOORS.forEach((d, di) => {
      const bx = doorBox(d);
      if (!(bx.mask & mask)) return; // e.g. dog flap: the door never blocks this agent
      const pad = r + 0.05;
      const c0x = Math.floor((bx.x0 - pad - this.x0) / this.cell);
      const c1x = Math.floor((bx.x1 + pad - this.x0) / this.cell);
      const c0z = Math.floor((bx.z0 - pad - this.z0) / this.cell);
      const c1z = Math.floor((bx.z1 + pad - this.z0) / this.cell);
      for (let cz = c0z; cz <= c1z; cz++) {
        for (let cx = c0x; cx <= c1x; cx++) {
          if (cx < 0 || cz < 0 || cx >= this.w || cz >= this.h) continue;
          const i = cz * this.w + cx;
          if (this.blocked[i]) continue;
          const x = this.x0 + (cx + 0.5) * this.cell;
          const z = this.z0 + (cz + 0.5) * this.cell;
          // Only cells that the closed leaf would actually block.
          const dx = Math.max(bx.x0 - x, 0, x - bx.x1);
          const dz = Math.max(bx.z0 - z, 0, z - bx.z1);
          if (dx * dx + dz * dz < r * r) this.doorAt[i] = di;
        }
      }
    });
    this.computeComponents();
  }

  private computeComponents() {
    let id = 0;
    const stack: number[] = [];
    for (let i = 0; i < this.blocked.length; i++) {
      if (this.blocked[i] || this.comp[i] >= 0) continue;
      this.comp[i] = id;
      stack.push(i);
      while (stack.length) {
        const c = stack.pop()!;
        const cx = c % this.w;
        const cz = (c - cx) / this.w;
        for (let k = 0; k < 4; k++) {
          const nx = cx + (k === 0 ? 1 : k === 1 ? -1 : 0);
          const nz = cz + (k === 2 ? 1 : k === 3 ? -1 : 0);
          if (nx < 0 || nz < 0 || nx >= this.w || nz >= this.h) continue;
          const ni = nz * this.w + nx;
          if (this.blocked[ni] || this.comp[ni] >= 0) continue;
          this.comp[ni] = id;
          stack.push(ni);
        }
      }
      id++;
    }
  }

  cellOf(x: number, z: number): number {
    const cx = Math.floor((x - this.x0) / this.cell);
    const cz = Math.floor((z - this.z0) / this.cell);
    if (cx < 0 || cz < 0 || cx >= this.w || cz >= this.h) return -1;
    return cz * this.w + cx;
  }

  centerOf(i: number): PathPoint {
    const cx = i % this.w;
    const cz = (i - cx) / this.w;
    return { x: this.x0 + (cx + 0.5) * this.cell, z: this.z0 + (cz + 0.5) * this.cell };
  }

  isFree(x: number, z: number): boolean {
    const i = this.cellOf(x, z);
    return i >= 0 && !this.blocked[i];
  }

  /** Nearest free cell center (BFS in rings). */
  nearestFree(x: number, z: number, maxRadius = 12): PathPoint | null {
    const i0 = this.cellOf(x, z);
    if (i0 >= 0 && !this.blocked[i0]) return { x, z };
    const cx0 = Math.floor((x - this.x0) / this.cell);
    const cz0 = Math.floor((z - this.z0) / this.cell);
    const maxR = Math.ceil(maxRadius / this.cell);
    for (let rr = 1; rr <= maxR; rr++) {
      let best = -1;
      let bestD = Infinity;
      for (let dz = -rr; dz <= rr; dz++) {
        for (let dx = -rr; dx <= rr; dx++) {
          if (Math.max(Math.abs(dx), Math.abs(dz)) !== rr) continue;
          const cx = cx0 + dx;
          const cz = cz0 + dz;
          if (cx < 0 || cz < 0 || cx >= this.w || cz >= this.h) continue;
          const i = cz * this.w + cx;
          if (this.blocked[i]) continue;
          const c = this.centerOf(i);
          const d = (c.x - x) ** 2 + (c.z - z) ** 2;
          if (d < bestD) {
            bestD = d;
            best = i;
          }
        }
      }
      if (best >= 0) return this.centerOf(best);
    }
    return null;
  }

  /** Is the straight segment walkable (cells free, doors passable at zero cost)? */
  lineClear(ax: number, az: number, bx: number, bz: number, doorCost?: DoorCostFn): boolean {
    const dx = bx - ax;
    const dz = bz - az;
    const L = Math.hypot(dx, dz);
    const steps = Math.max(1, Math.ceil(L / 0.12));
    for (let s = 0; s <= steps; s++) {
      const t = s / steps;
      const i = this.cellOf(ax + dx * t, az + dz * t);
      if (i < 0 || this.blocked[i]) return false;
      const d = this.doorAt[i];
      if (d >= 0 && doorCost && doorCost(d) > 0) return false;
    }
    return true;
  }

  /**
   * A* from (sx,sz) to (tx,tz). Returns smoothed waypoints (excluding the start) or null.
   * maxExpand bounds the search for robustness.
   */
  findPath(sx: number, sz: number, tx: number, tz: number, doorCost: DoorCostFn, maxExpand = 20000): PathPoint[] | null {
    let s = this.cellOf(sx, sz);
    let t = this.cellOf(tx, tz);
    if (s < 0 || t < 0) return null;
    if (this.blocked[s]) {
      const p = this.nearestFree(sx, sz, 3);
      if (!p) return null;
      s = this.cellOf(p.x, p.z);
    }
    let target = { x: tx, z: tz };
    if (this.blocked[t]) {
      const p = this.nearestFree(tx, tz, 4);
      if (!p) return null;
      t = this.cellOf(p.x, p.z);
      target = p;
    }
    if (s === t) return [target];
    const gen = ++this.gen;
    const W = this.w;
    const heap = this.heap;
    heap.clear();
    const tcx = t % W;
    const tcz = (t - tcx) / W;
    const hfn = (i: number) => {
      const cx = i % W;
      const cz = (i - cx) / W;
      const ddx = Math.abs(cx - tcx);
      const ddz = Math.abs(cz - tcz);
      return (ddx + ddz + (Math.SQRT2 - 2) * Math.min(ddx, ddz)) * this.cell;
    };
    this.g[s] = 0;
    this.seen[s] = gen;
    this.parent[s] = -1;
    heap.push(s, hfn(s));
    let expanded = 0;
    let found = false;
    while (heap.size) {
      const c = heap.pop();
      if (this.closed[c] === gen) continue;
      this.closed[c] = gen;
      if (c === t) {
        found = true;
        break;
      }
      if (++expanded > maxExpand) break;
      const cx = c % W;
      const cz = (c - cx) / W;
      const gc = this.g[c];
      for (let k = 0; k < 8; k++) {
        const ox = OX[k];
        const oz = OZ[k];
        const nx = cx + ox;
        const nz = cz + oz;
        if (nx < 0 || nz < 0 || nx >= W || nz >= this.h) continue;
        const ni = nz * W + nx;
        if (this.blocked[ni] || this.closed[ni] === gen) continue;
        const diag = ox !== 0 && oz !== 0;
        if (diag) {
          // No corner cutting.
          if (this.blocked[cz * W + nx] || this.blocked[nz * W + cx]) continue;
        }
        let step = diag ? this.cell * Math.SQRT2 : this.cell;
        const d = this.doorAt[ni];
        if (d >= 0 && this.doorAt[c] !== d) {
          const dc = doorCost(d);
          if (!isFinite(dc)) continue;
          step += dc;
        }
        const ng = gc + step;
        if (this.seen[ni] !== gen || ng < this.g[ni]) {
          this.seen[ni] = gen;
          this.g[ni] = ng;
          this.parent[ni] = c;
          heap.push(ni, ng + hfn(ni));
        }
      }
    }
    if (!found) return null;
    const cells: number[] = [];
    for (let c = t; c !== -1; c = this.parent[c]) cells.push(c);
    cells.reverse();
    const raw = cells.map((c) => this.centerOf(c));
    raw[raw.length - 1] = target;
    return this.smooth({ x: sx, z: sz }, raw, doorCost);
  }

  /** Greedy string pulling; keeps door crossings explicit so agents stop to open them. */
  private smooth(start: PathPoint, pts: PathPoint[], doorCost: DoorCostFn): PathPoint[] {
    const out: PathPoint[] = [];
    let cur = start;
    let i = 0;
    while (i < pts.length) {
      let best = i;
      for (let j = pts.length - 1; j > i; j--) {
        if (this.lineClear(cur.x, cur.z, pts[j].x, pts[j].z, doorCost)) {
          best = j;
          break;
        }
      }
      out.push(pts[best]);
      cur = pts[best];
      i = best + 1;
    }
    return out;
  }

  /** Same connected component (ignoring door states)? */
  connected(ax: number, az: number, bx: number, bz: number): boolean {
    const a = this.cellOf(ax, az);
    const b = this.cellOf(bx, bz);
    if (a < 0 || b < 0) return false;
    return this.comp[a] >= 0 && this.comp[a] === this.comp[b];
  }
}
