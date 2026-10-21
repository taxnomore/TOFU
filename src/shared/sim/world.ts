// Static world built once per ambiance from the map data, shared by the
// simulation and the AI.
import { Box, StaticColliders, doorBox } from '../world/colliders';
import { CAT_EDGES, CAT_NODES, DOORS, ITEMS, STATIONS } from '../world/map';
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

  constructor(readonly variant: Variant = DEFAULT_VARIANT) {
    this.cols = new StaticColliders(variant);
    this.humanNav = new NavGrid(this.cols, MASK_HUMAN, HUMAN.radius);
    this.dogNav = new NavGrid(this.cols, MASK_DOG, DOG.radius);
    this.doorBoxes = DOORS.map(doorBox);
    STATIONS.forEach((s, i) => this.stationIndex.set(s.id, i));
    ITEMS.forEach((it, i) => this.itemIndex.set(it.id, i));
    DOORS.forEach((d, i) => this.doorIndex.set(d.id, i));
    CAT_NODES.forEach((n, i) => this.catNodeIndex.set(n.id, i));
    this.catAdj = CAT_NODES.map(() => []);
    for (const e of CAT_EDGES) {
      const a = this.catNodeIndex.get(e.a)!;
      const b = this.catNodeIndex.get(e.b)!;
      const na = CAT_NODES[a];
      const nb = CAT_NODES[b];
      const len = Math.hypot(na.x - nb.x, na.z - nb.z, (na.y - nb.y) * 0.8);
      const door = e.door ? this.doorIndex.get(e.door)! : e.flap ? this.doorIndex.get(e.flap)! : -1;
      const link = { len, jump: !!e.jump, door, flap: !!e.flap };
      this.catAdj[a].push({ to: b, ...link });
      this.catAdj[b].push({ to: a, ...link });
    }
  }
}

const shared = new Map<Variant, World>();

export function getWorld(variant: Variant = DEFAULT_VARIANT): World {
  let w = shared.get(variant);
  if (!w) {
    w = new World(variant);
    shared.set(variant, w);
  }
  return w;
}
