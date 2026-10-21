import { describe, expect, it } from 'vitest';
import { StaticColliders, doorBox } from '../src/shared/world/colliders';
import { NavGrid } from '../src/shared/world/nav';
import {
  CAT_EDGES, CAT_NODES, DOORS, ITEMS, PUDDLES, SPAWNS, STATIONS, ZONES, zoneAt,
} from '../src/shared/world/map';
import { MASK_DOG, MASK_HUMAN } from '../src/shared/world/types';
import { ITEM_TYPES } from '../src/shared/world/itemTypes';
import { distToSegment } from '../src/shared/math';
import { VARIANTS, presentIn } from '../src/shared/world/variants';

const cols = new StaticColliders();
const humanNav = new NavGrid(cols, MASK_HUMAN, 0.34);
const dogNav = new NavGrid(cols, MASK_DOG, 0.3);
const allOpen = () => 0;

function stationAnchor(s: (typeof STATIONS)[number]) {
  return { x: s.x, z: s.z, hw: s.hw ?? 0, hd: s.hd ?? 0 };
}

/** A point is "reachable" if some free cell of the main component lies within reach of it. */
function reachableWithin(nav: NavGrid, x: number, z: number, reach: number, hw = 0, hd = 0): boolean {
  const main = nav.comp[nav.cellOf(SPAWNS.humans[0].x, SPAWNS.humans[0].z)];
  const r = reach + Math.max(hw, hd) + 0.5;
  for (let dz = -r; dz <= r; dz += 0.25) {
    for (let dx = -r; dx <= r; dx += 0.25) {
      const px = x + dx;
      const pz = z + dz;
      const i = nav.cellOf(px, pz);
      if (i < 0 || nav.blocked[i] || nav.comp[i] !== main) continue;
      const c = nav.centerOf(i);
      const ex = Math.max(Math.abs(c.x - x) - hw, 0);
      const ez = Math.max(Math.abs(c.z - z) - hd, 0);
      if (Math.hypot(ex, ez) <= reach) return true;
    }
  }
  return false;
}

describe('world map', () => {
  it('spawns are on free cells', () => {
    for (const s of SPAWNS.humans) expect(humanNav.isFree(s.x, s.z)).toBe(true);
    expect(dogNav.isFree(SPAWNS.tofu.x, SPAWNS.tofu.z)).toBe(true);
  });

  it('every zone is reachable by humans when doors are open', () => {
    const s = SPAWNS.humans[0];
    for (const zn of ZONES) {
      // Find any free cell inside the zone that belongs to the main component.
      let ok = false;
      for (let z = zn.z0 + 0.25; z < zn.z1 && !ok; z += 0.5) {
        for (let x = zn.x0 + 0.25; x < zn.x1 && !ok; x += 0.5) {
          if (zoneAt(x, z)?.id !== zn.id) continue;
          if (humanNav.isFree(x, z) && humanNav.connected(s.x, s.z, x, z)) ok = true;
        }
      }
      expect(ok, `zone ${zn.id}`).toBe(true);
    }
  });

  it('humans can path from the bedroom to the square and the bakery', () => {
    const p = humanNav.findPath(-11, -4.5, -20, 0, allOpen);
    expect(p).not.toBeNull();
    const q = humanNav.findPath(-11, -4.5, -2, -25, allOpen);
    expect(q).not.toBeNull();
  });

  it('closed doors block humans unless a door cost is allowed', () => {
    const closed = (i: number) => (DOORS[i].kind === 'interior' ? Infinity : 0);
    // Bedroom is only reachable through its door.
    const p = humanNav.findPath(-6.5, -2, -11, -4.5, closed);
    expect(p).toBeNull();
    const q = humanNav.findPath(-6.5, -2, -11, -4.5, (i) => (DOORS[i].kind === 'interior' ? 2 : 0));
    expect(q).not.toBeNull();
  });

  it('the hedge hole is for dogs only', () => {
    // From the garden to the square: humans must go through the house or the gates.
    const viaHoleOnly = (i: number) => (DOORS[i].kind === 'gate' || DOORS[i].kind === 'exterior' || DOORS[i].kind === 'bay' ? Infinity : 0);
    expect(humanNav.findPath(-10, 15, -18, 15, viaHoleOnly)).toBeNull();
    expect(dogNav.findPath(-10, 15, -18, 15, viaHoleOnly)).not.toBeNull();
  });

  it('dog flap lets the dog through the closed back door', () => {
    const backDoorClosed = (i: number) => (DOORS[i].id === 'porte_arriere' || DOORS[i].kind !== 'interior' ? Infinity : 0);
    expect(dogNav.findPath(-6.5, 4.5, -6.5, 8.5, backDoorClosed)).not.toBeNull();
    expect(humanNav.findPath(-6.5, 4.5, -6.5, 8.5, backDoorClosed)).toBeNull();
  });

  it('all stations are reachable by humans', () => {
    for (const s of STATIONS) {
      const a = stationAnchor(s);
      expect(reachableWithin(humanNav, a.x, a.z, s.r, a.hw, a.hd), `station ${s.id}`).toBe(true);
    }
  });

  it('all items are reachable by humans', () => {
    for (const it of ITEMS) {
      if (it.station) continue;
      const t = ITEM_TYPES[it.type];
      expect(t, it.type).toBeTruthy();
      expect(reachableWithin(humanNav, it.x!, it.z!, 1.0 + t.size), `item ${it.id}`).toBe(true);
    }
  });

  it('stations referenced by items exist', () => {
    for (const it of ITEMS) {
      if (it.station) expect(STATIONS.find((s) => s.id === it.station), it.id).toBeTruthy();
    }
  });

  it('puddles are reachable by the dog', () => {
    for (const p of PUDDLES) expect(reachableWithin(dogNav, p.x, p.z, p.r), p.id).toBe(true);
  });

  it('door boxes sit inside wall openings (not overlapping solid wall colliders)', () => {
    for (const d of DOORS) {
      const b = doorBox(d);
      const cx = (b.x0 + b.x1) / 2;
      const cz = (b.z0 + b.z1) / 2;
      // The center of a door opening must be free of static colliders for humans.
      expect(cols.overlaps(cx, cz, 0.05, MASK_HUMAN), d.id).toBe(false);
    }
  });

  it('cat graph is connected and walk edges avoid solid obstacles', () => {
    const ids = new Set(CAT_NODES.map((n) => n.id));
    for (const e of CAT_EDGES) {
      expect(ids.has(e.a), e.a).toBe(true);
      expect(ids.has(e.b), e.b).toBe(true);
    }
    // Connectivity
    const adj = new Map<string, string[]>();
    for (const n of CAT_NODES) adj.set(n.id, []);
    for (const e of CAT_EDGES) {
      adj.get(e.a)!.push(e.b);
      adj.get(e.b)!.push(e.a);
    }
    const seen = new Set<string>([CAT_NODES[0].id]);
    const stack = [CAT_NODES[0].id];
    while (stack.length) {
      for (const nb of adj.get(stack.pop()!)!) if (!seen.has(nb)) { seen.add(nb); stack.push(nb); }
    }
    expect(seen.size).toBe(CAT_NODES.length);
    // Walk edges on the ground must not cross walls/furniture that block the dog.
    const byId = new Map(CAT_NODES.map((n) => [n.id, n]));
    for (const e of CAT_EDGES) {
      if (e.jump) continue;
      const a = byId.get(e.a)!;
      const b = byId.get(e.b)!;
      if (a.y > 0.1 || b.y > 0.1) continue;
      const L = Math.hypot(b.x - a.x, b.z - a.z);
      const steps = Math.ceil(L / 0.2);
      for (let s = 1; s < steps; s++) {
        const t = s / steps;
        const x = a.x + (b.x - a.x) * t;
        const z = a.z + (b.z - a.z) * t;
        // Ignore the door opening itself (door edges are conditional).
        const nearDoor = DOORS.some((d) => {
          const bx = doorBox(d);
          return x > bx.x0 - 0.4 && x < bx.x1 + 0.4 && z > bx.z0 - 0.4 && z < bx.z1 + 0.4;
        });
        if (nearDoor) continue;
        expect(cols.overlaps(x, z, 0.12, MASK_DOG), `cat edge ${e.a}-${e.b} at ${x.toFixed(2)},${z.toFixed(2)}`).toBe(false);
      }
    }
  });

  it('distToSegment helper sanity', () => {
    expect(distToSegment(0, 0, 10, 0, 5, 3)).toBeCloseTo(3);
  });
});

describe.each(VARIANTS.map((v) => v.id))('ambiance %s', (variant) => {
  const vcols = new StaticColliders(variant);
  const vHuman = new NavGrid(vcols, MASK_HUMAN, 0.34);
  const vDog = new NavGrid(vcols, MASK_DOG, 0.3);

  it('spawns are free and the square is still reachable', () => {
    for (const s of SPAWNS.humans) expect(vHuman.isFree(s.x, s.z)).toBe(true);
    expect(vDog.isFree(SPAWNS.tofu.x, SPAWNS.tofu.z)).toBe(true);
    expect(vHuman.findPath(-11, -4.5, -20, 0, allOpen)).not.toBeNull();
    expect(vDog.findPath(-10, 15, -18, 15, allOpen)).not.toBeNull();
  });

  it('its stations and objects are reachable by humans', () => {
    for (const s of STATIONS) {
      if (!presentIn(s.only, variant)) continue;
      const a = stationAnchor(s);
      expect(reachableWithin(vHuman, a.x, a.z, s.r, a.hw, a.hd), `station ${s.id}`).toBe(true);
    }
    for (const it of ITEMS) {
      if (it.station || !presentIn(it.only, variant)) continue;
      expect(reachableWithin(vHuman, it.x!, it.z!, 1.0 + ITEM_TYPES[it.type].size), `item ${it.id}`).toBe(true);
    }
  });

  it('floor objects do not stand inside furniture or walls', () => {
    for (const it of ITEMS) {
      if (it.station || (it.y ?? 0) > 0.1 || !presentIn(it.only, variant)) continue;
      expect(vcols.overlaps(it.x!, it.z!, 0.05, MASK_DOG), `item ${it.id}`).toBe(false);
    }
  });

  it('cat walk edges avoid its props', () => {
    const byId = new Map(CAT_NODES.map((n) => [n.id, n]));
    for (const e of CAT_EDGES) {
      const a = byId.get(e.a)!;
      const b = byId.get(e.b)!;
      if (e.jump || a.y > 0.1 || b.y > 0.1) continue;
      const n = Math.ceil(Math.hypot(b.x - a.x, b.z - a.z) / 0.2);
      for (let k = 1; k < n; k++) {
        const x = a.x + ((b.x - a.x) * k) / n;
        const z = a.z + ((b.z - a.z) * k) / n;
        const nearDoor = DOORS.some((d) => {
          const bx = doorBox(d);
          return x > bx.x0 - 0.4 && x < bx.x1 + 0.4 && z > bx.z0 - 0.4 && z < bx.z1 + 0.4;
        });
        if (!nearDoor) expect(vcols.overlaps(x, z, 0.12, MASK_DOG), `cat edge ${e.a}-${e.b}`).toBe(false);
      }
    }
  });
});
