import { describe, expect, it } from 'vitest';
import { StaticColliders, doorBox } from '../src/shared/world/colliders';
import { NavGrid } from '../src/shared/world/nav';
import type { GameMap } from '../src/shared/world/mapTypes';
import { MAP_LIST, getMap } from '../src/shared/world/maps';
import { MASK_DOG, MASK_HUMAN } from '../src/shared/world/types';
import { ITEM_TYPES } from '../src/shared/world/itemTypes';
import { distToSegment } from '../src/shared/math';
import { presentIn } from '../src/shared/world/variants';
import { Game } from '../src/shared/sim/game';
import { SECRET_DEFS, TASK_DEFS } from '../src/shared/sim/rules';
import type { StationDef } from '../src/shared/world/types';

const allOpen = () => 0;

function stationAnchor(s: StationDef) {
  return { x: s.x, z: s.z, hw: s.hw ?? 0, hd: s.hd ?? 0 };
}

/** A point is "reachable" if some free cell of the main component lies within reach of it. */
function reachableWithin(map: GameMap, nav: NavGrid, x: number, z: number, reach: number, hw = 0, hd = 0): boolean {
  const main = nav.comp[nav.cellOf(map.spawns.humans[0].x, map.spawns.humans[0].z)];
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

function nearDoor(map: GameMap, x: number, z: number): boolean {
  return map.doors.some((d) => {
    const bx = doorBox(d);
    return x > bx.x0 - 0.4 && x < bx.x1 + 0.4 && z > bx.z0 - 0.4 && z < bx.z1 + 0.4;
  });
}

const CASES = MAP_LIST.flatMap((m) => m.variants.map((v) => [m.id, v] as const));

describe.each(MAP_LIST.map((m) => m.id))('map %s (data)', (mapId) => {
  const map = getMap(mapId);

  it('ids are unique and references exist', () => {
    for (const list of [map.zones, map.stations, map.items, map.doors, map.catNodes] as { id: string }[][]) {
      const ids = list.map((x) => x.id);
      expect(new Set(ids).size, ids.join(',')).toBe(ids.length);
    }
    for (const it of map.items) {
      expect(ITEM_TYPES[it.type], it.type).toBeTruthy();
      if (it.station) expect(map.stations.find((s) => s.id === it.station), it.id).toBeTruthy();
    }
    for (const w of map.walls) for (const o of w.openings ?? []) if (o.door) expect(map.doors.find((d) => d.id === o.door), o.door).toBeTruthy();
    const nodes = new Set(map.catNodes.map((n) => n.id));
    expect(nodes.has(map.catStart)).toBe(true);
    for (const e of map.catEdges) {
      expect(nodes.has(e.a), e.a).toBe(true);
      expect(nodes.has(e.b), e.b).toBe(true);
      for (const d of [e.door, e.flap]) if (d) expect(map.doors.find((x) => x.id === d), d).toBeTruthy();
    }
    for (const id of map.secrets) expect(SECRET_DEFS.find((s) => s.id === id), id).toBeTruthy();
    for (const z of [...map.streetZones, ...map.outsideZones, ...map.snowyZones, ...map.muddyZones]) expect(map.zoneById(z), z).toBeTruthy();
    for (const [, , z] of map.ai.indoorSpots) expect(map.zoneById(z), z).toBeTruthy();
    for (const [door, task] of Object.entries(map.ai.protectedDoors)) {
      expect(map.doors.find((d) => d.id === door), door).toBeTruthy();
      if (task !== '*') expect(map.tasks[task], task).toBeTruthy();
    }
    expect(map.stations.some((s) => s.kind === 'dog_basket'), 'a hiding place for Tofu').toBe(true);
    expect(map.stations.some((s) => s.kind === 'treat_jar'), 'a treat jar').toBe(true);
  });

  it('every job can be done: its objects exist and fit their station', () => {
    expect(map.taskIds.length).toBeGreaterThanOrEqual(6);
    const g = new Game({ seed: 1, duration: 300, noCountdown: true, map: mapId, players: [{ role: 'tofu', name: 'T', avatar: 0, ai: true }, { role: 'human', name: 'H', avatar: 0, ai: true }] });
    const station = (id: string) => {
      const si = g.world.stationIndex.get(id);
      expect(si, id).not.toBeUndefined();
      return si!;
    };
    for (const kind of map.taskIds) {
      const spec = TASK_DEFS[kind].spec;
      const fits = (itemId: string, stationId: string) => {
        const it = g.itemById(itemId);
        expect(it, itemId).toBeTruthy();
        const si = station(stationId);
        const saved = g.state.stations[si].items;
        g.state.stations[si].items = [];
        expect(g.accepts(si, it!), `${kind}: ${itemId} -> ${stationId}`).toBe(true);
        g.state.stations[si].items = saved;
      };
      switch (spec.type) {
        case 'collect':
          for (const id of spec.items) fits(id, spec.dest);
          expect((spec.kinds as string[]).includes(map.stations[station(spec.dest)].kind)).toBe(true);
          break;
        case 'deliver':
          fits(spec.item, spec.dest);
          if (spec.restock) station(spec.restock.station);
          break;
        case 'make':
          expect(map.stations[station(spec.station)].kind).toBe('bed');
          break;
        case 'water':
          for (const b of spec.beds) expect(map.stations[station(b)].kind).toBe('flowerbed');
          expect(map.stations[station(spec.tap)].kind).toBe('tap');
          expect(g.itemById(spec.can)?.type).toBe('watering_can');
          break;
      }
    }
  });

  it('cat graph is connected', () => {
    const adj = new Map<string, string[]>();
    for (const n of map.catNodes) adj.set(n.id, []);
    for (const e of map.catEdges) {
      adj.get(e.a)!.push(e.b);
      adj.get(e.b)!.push(e.a);
    }
    const seen = new Set<string>([map.catNodes[0].id]);
    const stack = [map.catNodes[0].id];
    while (stack.length) {
      for (const nb of adj.get(stack.pop()!)!) if (!seen.has(nb)) { seen.add(nb); stack.push(nb); }
    }
    expect([...adj.keys()].filter((k) => !seen.has(k))).toEqual([]);
  });
});

describe.each(CASES)('map %s, ambiance %s', (mapId, variant) => {
  const map = getMap(mapId);
  const cols = new StaticColliders(map, variant);
  const humanNav = new NavGrid(cols, MASK_HUMAN, 0.34);
  const dogNav = new NavGrid(cols, MASK_DOG, 0.3);

  it('spawns, robot dock, hints and puddles are on free ground', () => {
    for (const s of map.spawns.humans) expect(humanNav.isFree(s.x, s.z)).toBe(true);
    expect(dogNav.isFree(map.spawns.tofu.x, map.spawns.tofu.z)).toBe(true);
    expect(reachableWithin(map, dogNav, map.vacuum.x, map.vacuum.z, 0.8), 'robot dock').toBe(true);
    for (const [x, z] of [...map.ai.indoorSpots, ...map.ai.escapes, ...map.ai.streetDrops]) {
      expect(reachableWithin(map, dogNav, x, z, 0.8), `hint ${x},${z}`).toBe(true);
    }
    for (const [x, z] of map.ai.streetDrops) expect(map.streetZones.includes(map.zoneAt(x, z)?.id ?? ''), `street drop ${x},${z}`).toBe(true);
    for (const [x, z, zone] of map.ai.indoorSpots) expect(map.zoneAt(x, z)?.id, `spot ${x},${z}`).toBe(zone);
    for (const p of map.puddles) expect(reachableWithin(map, dogNav, p.x, p.z, p.r), p.id).toBe(true);
    const B = map.bounds;
    const c = map.carrier;
    for (const x of [c.x0, c.x1]) expect(x >= B.x0 - 1 && x <= B.x1 + 1, 'carrier path').toBe(true);
  });

  it('every zone is reachable by humans when doors are open', () => {
    const s = map.spawns.humans[0];
    for (const zn of map.zones) {
      let ok = false;
      for (let z = zn.z0 + 0.25; z < zn.z1 && !ok; z += 0.5) {
        for (let x = zn.x0 + 0.25; x < zn.x1 && !ok; x += 0.5) {
          if (map.zoneAt(x, z)?.id !== zn.id) continue;
          if (humanNav.isFree(x, z) && humanNav.connected(s.x, s.z, x, z)) ok = true;
        }
      }
      expect(ok, `zone ${zn.id}`).toBe(true);
    }
  });

  it('its stations and objects are reachable by humans', () => {
    for (const s of map.stations) {
      if (!presentIn(s.only, variant)) continue;
      const a = stationAnchor(s);
      expect(reachableWithin(map, humanNav, a.x, a.z, s.r, a.hw, a.hd), `station ${s.id}`).toBe(true);
    }
    for (const it of map.items) {
      if (it.station || !presentIn(it.only, variant)) continue;
      expect(reachableWithin(map, humanNav, it.x!, it.z!, 1.0 + ITEM_TYPES[it.type].size), `item ${it.id}`).toBe(true);
    }
  });

  it('floor objects do not stand inside furniture or walls', () => {
    for (const it of map.items) {
      if (it.station || (it.y ?? 0) > 0.1 || !presentIn(it.only, variant)) continue;
      expect(cols.overlaps(it.x!, it.z!, 0.05, MASK_DOG), `item ${it.id}`).toBe(false);
    }
  });

  it('door boxes sit inside wall openings', () => {
    for (const d of map.doors) {
      const b = doorBox(d);
      expect(cols.overlaps((b.x0 + b.x1) / 2, (b.z0 + b.z1) / 2, 0.05, MASK_HUMAN), d.id).toBe(false);
    }
  });

  it('cat walk edges avoid walls and furniture', () => {
    const byId = new Map(map.catNodes.map((n) => [n.id, n]));
    for (const e of map.catEdges) {
      const a = byId.get(e.a)!;
      const b = byId.get(e.b)!;
      if (e.jump || a.y > 0.1 || b.y > 0.1) continue;
      const n = Math.ceil(Math.hypot(b.x - a.x, b.z - a.z) / 0.2);
      for (let k = 1; k < n; k++) {
        const x = a.x + ((b.x - a.x) * k) / n;
        const z = a.z + ((b.z - a.z) * k) / n;
        if (!nearDoor(map, x, z)) expect(cols.overlaps(x, z, 0.12, MASK_DOG), `cat edge ${e.a}-${e.b} at ${x.toFixed(2)},${z.toFixed(2)}`).toBe(false);
      }
    }
  });
});

describe('the neighborhood', () => {
  const map = getMap('quartier');
  const cols = new StaticColliders(map);
  const humanNav = new NavGrid(cols, MASK_HUMAN, 0.34);
  const dogNav = new NavGrid(cols, MASK_DOG, 0.3);
  const DOORS = map.doors;

  it('humans can path from the bedroom to the square and the bakery', () => {
    expect(humanNav.findPath(-11, -4.5, -20, 0, allOpen)).not.toBeNull();
    expect(humanNav.findPath(-11, -4.5, -2, -25, allOpen)).not.toBeNull();
  });

  it('closed doors block humans unless a door cost is allowed', () => {
    const closed = (i: number) => (DOORS[i].kind === 'interior' ? Infinity : 0);
    expect(humanNav.findPath(-6.5, -2, -11, -4.5, closed)).toBeNull();
    expect(humanNav.findPath(-6.5, -2, -11, -4.5, (i) => (DOORS[i].kind === 'interior' ? 2 : 0))).not.toBeNull();
  });

  it('the hedge hole is for dogs only', () => {
    const viaHoleOnly = (i: number) => (DOORS[i].kind === 'gate' || DOORS[i].kind === 'exterior' || DOORS[i].kind === 'bay' ? Infinity : 0);
    expect(humanNav.findPath(-10, 15, -18, 15, viaHoleOnly)).toBeNull();
    expect(dogNav.findPath(-10, 15, -18, 15, viaHoleOnly)).not.toBeNull();
  });

  it('dog flap lets the dog through the closed back door', () => {
    const backDoorClosed = (i: number) => (DOORS[i].id === 'porte_arriere' || DOORS[i].kind !== 'interior' ? Infinity : 0);
    expect(dogNav.findPath(-6.5, 4.5, -6.5, 8.5, backDoorClosed)).not.toBeNull();
    expect(humanNav.findPath(-6.5, 4.5, -6.5, 8.5, backDoorClosed)).toBeNull();
  });

  it('distToSegment helper sanity', () => {
    expect(distToSegment(0, 0, 10, 0, 5, 3)).toBeCloseTo(3);
  });
});
