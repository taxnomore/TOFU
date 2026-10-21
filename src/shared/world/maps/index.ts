// Every playable map. A game picks one; the server can run several rooms on
// different maps at the same time, so nothing reads a "current" map globally.
import { GameMap, MapDef, MapId, TaskInfo, buildMap } from '../mapTypes';
import { QUARTIER } from './quartier';

const DEFS: MapDef[] = [QUARTIER];

export const DEFAULT_MAP: MapId = 'quartier';

/** Short descriptions for the setup screens. */
export const MAP_LIST = DEFS.map((d) => ({ id: d.id, name: d.name, icon: d.icon, desc: d.desc, variants: d.variants }));

const cache = new Map<MapId, GameMap>();

export function isMapId(v: unknown): v is MapId {
  return typeof v === 'string' && DEFS.some((d) => d.id === v);
}

export function getMap(id: MapId = DEFAULT_MAP): GameMap {
  let m = cache.get(id);
  if (!m) {
    const def = DEFS.find((d) => d.id === id) ?? DEFS[0];
    m = buildMap(def);
    cache.set(id, m);
  }
  return m;
}

/** Every job of every map, by id (ids are unique across maps). */
export const ALL_TASK_INFO: Record<string, TaskInfo> = Object.assign({}, ...DEFS.map((d) => d.tasks));
