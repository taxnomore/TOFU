// A playable map: the whole place as data (architecture, furniture, objects,
// cat routes), plus what makes it a game: the jobs of the humans, Tofu's
// secret challenges, the robot, the passer-by and hints for the computer.
import type {
  BuildingDef, CatEdge, CatNode, DoorDef, FloorKind, FloorPatch, ItemPlacement, PropDef, Puddle, Spawn, StationDef, StationKind,
  WallDef, Zone,
} from './types';
import type { Variant } from './variants';

export type MapId = 'quartier' | 'ecole' | 'centre' | 'parc';

export interface Rect {
  x0: number;
  z0: number;
  x1: number;
  z1: number;
}

/**
 * Jobs are built from a few patterns, so a new map only needs data:
 * - collect: bring several objects into stations of some kinds (laundry, toys);
 * - deliver: bring one object to one station (mail, dishes), with an optional
 *   shop where a human buys a new one when Tofu ate it;
 * - make: hold the button at a station (make the bed); Tofu undoes it;
 * - water: fill the can at a tap and water some beds.
 */
export type TaskSpec =
  | { type: 'collect'; items: string[]; kinds: StationKind[]; dest: string; destLabel: string }
  | {
    type: 'deliver'; item: string; dest: string; destLabel: string; itemLabel: string;
    restock?: { station: string; label: string; verb: string; thanks: string };
    /** When the job is not picked, the object stays where it is (instead of starting delivered). */
    keep?: boolean;
  }
  | { type: 'make'; station: string; label: string }
  | { type: 'water'; beds: string[]; can: string; tap: string; bedLabel: string; tapLabel: string };

export interface TaskInfo {
  title: string;
  hint: string;
  icon: string;
  spec: TaskSpec;
}

/** Sentences of the story, per map (French). */
export interface MapStory {
  /** "prépare la maison" (intro card: "Léa, prépare la maison !"). */
  prepare: string;
  /** Top bar while the countdown runs: "Les invités arrivent". */
  arriving: string;
  /** Big message when everything is ready. */
  ding: string;
  /** Tofu undid something during the countdown. */
  notReady: string;
  /** End: humans won. */
  ready: string;
  /** End: time is up. */
  late: string;
  /** End: too much chaos. */
  chaos: string;
  /** Intro card for the humans (without the cleanliness goal). */
  humans: string;
  /** Title of the job list. */
  listTitle: string;
  /** Cleanliness line of the job list: "Maison propre". */
  cleanLabel: string;
  /** "dans la maison": where dirty paws leave prints. */
  inside: string;
  /** First tip for the humans. */
  tipStart: string;
  /** Setup screen, "Jouer un humain" line. */
  humanRole: string;
}

export interface VacuumDef {
  x: number;
  z: number;
  facing: number;
  /** "l'aspirateur robot". */
  name: string;
  color?: number;
}

/** A passer-by walking along a straight line (x0 -> x1 at z). Tofu barks at them. */
export interface CarrierDef {
  z: number;
  x0: number;
  x1: number;
  stopX: number;
  /** "la factrice". */
  name: string;
  /** Chaos message when scared. */
  scared: string;
  look: 'carrier' | 'guard' | 'jogger';
  /** Walking speed (m/s), 1.35 by default. */
  speed?: number;
}

/** Hints for the computer players. */
export interface MapAI {
  /** Spots inside where a muddy Tofu runs to leave prints. */
  indoorSpots: [number, number, string][];
  /** Places to run away to. */
  escapes: [number, number][];
  /** Spots in the street where a stolen object scores. */
  streetDrops: [number, number][];
  /** Doors Tofu comes in by (humans wipe his paws there). */
  entrances: [number, number][];
  /** Doors the humans close behind them once this job is done ('*': always). */
  protectedDoors: Record<string, string>;
}

/** Roof over a building: hidden when the viewer is under it. */
export interface RoofDef extends Rect {
  style: 'hip' | 'flat' | 'gable';
  color?: number;
  /** Eaves height. */
  y?: number;
}

export interface MapDef {
  id: MapId;
  name: string;
  icon: string;
  desc: string;
  story: MapStory;
  bounds: Rect;
  wallHeight: number;
  zones: Zone[];
  /** Where an object taken from the property scores when dropped ("the street"). */
  streetZones: string[];
  /** Zones outside the property (less dirty, objects taken there do not score). */
  outsideZones: string[];
  /** Zones covered with snow in winter. */
  snowyZones: string[];
  /** Zones counted for the "mud in the bedrooms" challenge. */
  muddyZones: string[];
  floors: FloorPatch[];
  walls: WallDef[];
  buildings: BuildingDef[];
  doors: DoorDef[];
  props: PropDef[];
  stations: StationDef[];
  items: ItemPlacement[];
  puddles: Puddle[];
  spawns: { tofu: Spawn; humans: Spawn[] };
  catNodes: CatNode[];
  catEdges: CatEdge[];
  catStart: string;
  /** Ambiances offered on this map. */
  variants: Variant[];
  /** Jobs of the humans; the first one is always on the list. */
  tasks: Record<string, TaskInfo>;
  /** Secret challenges that make sense here (seasonal ones are added by the ambiance). */
  secrets: string[];
  /** Map-specific wording of some challenges. */
  secretWording?: Record<string, string>;
  vacuum: VacuumDef;
  carrier: CarrierDef;
  ai: MapAI;
  roofs: RoofDef[];
  /** A street along x drawn across the whole view (asphalt, curbs, center line, sidewalks). */
  road?: { z0: number; z1: number; walks: [number, number][]; crossings: [number, number][] };
  /** Distant houses around the map: x, z, width, depth, color. */
  backdrop?: [number, number, number, number, number][];
  /** Client decoration routine (signs, details). */
  decor: MapId;
  /** Chaos goal with 1 and 2 humans, when the map needs its own (default 250 / 180). */
  chaosGoals?: [number, number];
}

/** A map with its lookup helpers. */
export interface GameMap extends MapDef {
  zoneAt(x: number, z: number): Zone | null;
  zoneById(id: string): Zone | undefined;
  isIndoor(x: number, z: number): boolean;
  /** Inside, or on a floor where dirty paws leave prints (picnic deck). */
  messy(x: number, z: number): boolean;
  /** Floor under this point (the ground is grass). */
  floorAt(x: number, z: number): FloorKind;
  /** Under a roof (the roof is hidden when the camera follows someone there). */
  underRoof(x: number, z: number): boolean;
  /** Text of a secret challenge on this map. */
  secretText(id: string, fallback: string): string;
  /** Index of every task id in the task table. */
  readonly taskIds: string[];
}

/**
 * Job ids are unique across maps: the jobs of a newer map get its id as a
 * prefix ("ecole.poubelle"); the neighborhood keeps its short historic ids.
 */
export function qualifyTask(mapId: MapId, id: string): string {
  return mapId === 'quartier' || id === '*' ? id : `${mapId}.${id}`;
}

export function buildMap(def: MapDef): GameMap {
  const q = (id: string) => qualifyTask(def.id, id);
  const tasks = Object.fromEntries(Object.entries(def.tasks).map(([k, v]) => [q(k), v]));
  const protectedDoors = Object.fromEntries(Object.entries(def.ai.protectedDoors).map(([d, t]) => [d, q(t)]));
  const zoneAt = (x: number, z: number): Zone | null => {
    for (const zn of def.zones) {
      if (x >= zn.x0 && x < zn.x1 && z >= zn.z0 && z < zn.z1) return zn;
    }
    return null;
  };
  return {
    ...def,
    tasks,
    ai: { ...def.ai, protectedDoors },
    zoneAt,
    zoneById: (id: string) => def.zones.find((z) => z.id === id),
    isIndoor: (x: number, z: number) => !!zoneAt(x, z)?.indoor,
    messy: (x: number, z: number) => {
      const zn = zoneAt(x, z);
      return !!zn && (zn.indoor || !!zn.prints);
    },
    floorAt: (x: number, z: number): FloorKind => {
      for (let i = def.floors.length - 1; i >= 0; i--) {
        const f = def.floors[i];
        if (x >= f.x0 && x < f.x1 && z >= f.z0 && z < f.z1) return f.kind;
      }
      return zoneAt(x, z)?.floor ?? 'grass';
    },
    underRoof: (x: number, z: number) => def.roofs.some((r) => x > r.x0 && x < r.x1 && z > r.z0 && z < r.z1),
    secretText: (id: string, fallback: string) => def.secretWording?.[id] ?? fallback,
    taskIds: Object.keys(tasks),
  };
}
