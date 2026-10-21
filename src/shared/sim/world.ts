// Static world built once per map and ambiance from the map data, shared by
// the simulation and the AI.
import { Box, StaticColliders, doorBox } from '../world/colliders';
import type { GameMap, MapId } from '../world/mapTypes';
import { DEFAULT_MAP, getMap } from '../world/maps';
import { NavGrid } from '../world/nav';
import { MASK_DOG, MASK_HUMAN } from '../world/types';
import { DEFAULT_VARIANT, Variant } from '../world/variants';
import { DOG, HUMAN } from '../constants';

export interface CatLink {
  to: number;
  len: number;
  jump: boolean;
  door: number;
  flap: boolean;
}

export class World {
  readonly cols: StaticColliders;
  readonly humanNav: NavGrid;
  readonly dogNav: NavGrid;
  readonly doorBoxes: Box[];
  readonly stationIndex = new Map<string, number>();
  readonly itemIndex = new Map<string, number>();
  readonly doorIndex = new Map<string, number>();
  readonly catNodeIndex = new Map<string, number>();
  readonly catAdj: CatLink[][];
  readonly map: GameMap;

  constructor(readonly mapId: MapId = DEFAULT_MAP, readonly variant: Variant = DEFAULT_VARIANT) {
    const map = (this.map = getMap(mapId));
    this.cols = new StaticColliders(map, variant);
    this.humanNav = new NavGrid(this.cols, MASK_HUMAN, HUMAN.radius);
    this.dogNav = new NavGrid(this.cols, MASK_DOG, DOG.radius);
    this.doorBoxes = map.doors.map(doorBox);
    map.stations.forEach((s, i) => this.stationIndex.set(s.id, i));
    map.items.forEach((it, i) => this.itemIndex.set(it.id, i));
    map.doors.forEach((d, i) => this.doorIndex.set(d.id, i));
    map.catNodes.forEach((n, i) => this.catNodeIndex.set(n.id, i));
    this.catAdj = map.catNodes.map(() => []);
    for (const e of map.catEdges) {
      const a = this.catNodeIndex.get(e.a)!;
      const b = this.catNodeIndex.get(e.b)!;
      const na = map.catNodes[a];
      const nb = map.catNodes[b];
      const len = Math.hypot(na.x - nb.x, na.z - nb.z, (na.y - nb.y) * 0.8);
      const door = e.door ? this.doorIndex.get(e.door)! : e.flap ? this.doorIndex.get(e.flap)! : -1;
      const link = { len, jump: !!e.jump, door, flap: !!e.flap };
      this.catAdj[a].push({ to: b, ...link });
      this.catAdj[b].push({ to: a, ...link });
    }
  }
}

const shared = new Map<string, World>();

export function getWorld(mapId: MapId = DEFAULT_MAP, variant: Variant = DEFAULT_VARIANT): World {
  const key = `${mapId}:${variant}`;
  let w = shared.get(key);
  if (!w) {
    w = new World(mapId, variant);
    shared.set(key, w);
  }
  return w;
}
