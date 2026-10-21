// Data types describing the static world. The map is pure data: colliders,
// navigation grids and 3D meshes are all derived from it.

/** Collision masks: a collider blocks an agent if (collider.mask & agentMask) != 0. */
export const MASK_HUMAN = 1;
export const MASK_DOG = 2;
export const MASK_CAT = 4;
export const MASK_ITEM = 8;
export const MASK_ALL = MASK_HUMAN | MASK_DOG | MASK_CAT | MASK_ITEM;
export const MASK_SOLID = MASK_HUMAN | MASK_DOG | MASK_ITEM;

export type FloorKind =
  | 'grass'
  | 'parquet'
  | 'parquet_light'
  | 'carpet'
  | 'cement_tiles'
  | 'tomettes'
  | 'white_tiles'
  | 'terrace'
  | 'gravel'
  | 'pavers'
  | 'asphalt'
  | 'sidewalk'
  | 'sand'
  | 'soil'
  | 'crosswalk';

export interface Zone {
  id: string;
  /** French name with article, used in HUD messages ("dans la cuisine"). */
  name: string;
  /** Short label for the HUD location badge. */
  label: string;
  indoor: boolean;
  x0: number;
  z0: number;
  x1: number;
  z1: number;
  floor?: FloorKind;
  /** Interior wall paint for faces looking into this zone. */
  wallColor?: number;
}

export type WallStyle = 'house_ext' | 'house_int' | 'hedge' | 'stone' | 'fence' | 'low_wall' | 'facade' | 'garden_fence';

export type OpeningKind = 'door' | 'window' | 'arch' | 'gate' | 'doghole';

export interface Opening {
  /** Center position along the wall, measured from (x0,z0). */
  at: number;
  width: number;
  kind: OpeningKind;
  /** Door/gate id when the opening hosts a door entity. */
  door?: string;
  /** Window sill and top heights. */
  sill?: number;
  top?: number;
  /** Window is open (visual only: cat route). */
  open?: boolean;
}

export interface WallDef {
  id: string;
  x0: number;
  z0: number;
  x1: number;
  z1: number;
  style: WallStyle;
  height?: number;
  thickness?: number;
  openings?: Opening[];
  /** Exterior color override for facades. */
  color?: number;
  /** Shutter color for windows on this wall. */
  shutter?: number;
}

export type DoorKind = 'interior' | 'exterior' | 'bay' | 'gate';

export interface DoorDef {
  id: string;
  /** French name with article ("la porte de la cuisine"). */
  name: string;
  kind: DoorKind;
  x: number;
  z: number;
  /** Axis of the wall the door sits in. */
  axis: 'x' | 'z';
  width: number;
  /** Which end of the opening holds the hinge: -1 = low coordinate side, 1 = high side. */
  hinge: -1 | 1;
  /** Side the leaf swings toward (sign along the wall normal). */
  swing: -1 | 1;
  dogCanPush: boolean;
  dogFlap: boolean;
  open: boolean;
  color?: number;
}

export type PropType =
  | 'bed_double' | 'bed_single' | 'nightstand' | 'wardrobe' | 'dresser' | 'desk' | 'bookshelf' | 'bookshelf_low'
  | 'console' | 'coat_rack' | 'shoe_rack' | 'counter' | 'fridge' | 'round_table' | 'chair' | 'dining_table'
  | 'sofa' | 'armchair' | 'coffee_table' | 'tv_stand' | 'washing_machine' | 'bathtub' | 'toilet' | 'vanity'
  | 'rug' | 'rug_round' | 'floor_lamp' | 'wall_shelf' | 'picture'
  | 'garden_table' | 'garden_chair' | 'parasol' | 'clothes_post' | 'shed' | 'sandbox' | 'slide' | 'tree'
  | 'fruit_tree' | 'bush' | 'car' | 'streetlamp' | 'plane_tree' | 'bench' | 'bollard' | 'barrier' | 'spring_rider'
  | 'planter' | 'veg_patch' | 'flowerbed' | 'bike' | 'roadsign' | 'cafe_table' | 'awning' | 'mailbox_post'
  | 'dog_bowl' | 'pot_decor' | 'swing_set' | 'hydrant' | 'bus_shelter' | 'kennel'
  | 'toybox' | 'hamper' | 'dog_basket' | 'bakery_stand' | 'clothesline_basket';

export interface PropDef {
  type: PropType;
  x: number;
  z: number;
  /** Rotation around Y in quarter turns (0: front faces +z, 1: +x, 2: -z, 3: -x). */
  rot?: number;
  /** Optional size overrides (local x = w, local z = d). */
  w?: number;
  d?: number;
  h?: number;
  color?: number;
  color2?: number;
  /** Arbitrary variant index for visual variety. */
  v?: number;
}

export type StationKind =
  | 'hamper' | 'dresser' | 'clothesline' | 'toybox' | 'dining_table' | 'garden_table' | 'console'
  | 'street_bin' | 'mailbox' | 'cupboard' | 'counter' | 'treat_jar' | 'bakery' | 'bed' | 'sofa'
  | 'flowerbed' | 'dog_basket' | 'tap' | 'shoe_rack' | 'bedside';

export interface StationDef {
  id: string;
  kind: StationKind;
  name: string;
  x: number;
  z: number;
  /** Surface height where items rest. */
  y: number;
  /** Interaction radius (from character center to station center). */
  r: number;
  /** Local slot offsets where held items are displayed (x, y, z relative to station). */
  slots?: [number, number, number][];
  /** Tofu can grab items stored here. */
  dogReach?: boolean;
  /** Optional rectangular interaction area half extents (distance measured to the rect). */
  hw?: number;
  hd?: number;
  /** Knockable item that physically is this station (wheelie bin): knocking it spills the contents. */
  linkedItem?: string;
  /** Maximum stored items. */
  capacity?: number;
}

export interface BuildingDef {
  id: string;
  x0: number;
  z0: number;
  x1: number;
  z1: number;
  /** Side facing the street/player: 'n' (-z), 's' (+z). */
  front: 'n' | 's';
  storeys: number;
  color: number;
  shutter: number;
  door: number;
  /** Door center along x. */
  doorX: number;
  shop?: 'bakery';
}

export interface ItemPlacement {
  id: string;
  type: string;
  /** Initial station (item is stored there) or free position. */
  station?: string;
  x?: number;
  z?: number;
  y?: number;
  rot?: number;
}

export interface Puddle {
  id: string;
  x: number;
  z: number;
  r: number;
}

export interface FloorPatch {
  kind: FloorKind;
  x0: number;
  z0: number;
  x1: number;
  z1: number;
  /** Small vertical offset to avoid z-fighting between overlapping patches. */
  y?: number;
  /** Rotation of texture (quarter turns). */
  rot?: number;
}

export interface CatNode {
  id: string;
  x: number;
  z: number;
  y: number;
  /** Safe elevated spot. */
  perch?: boolean;
  /** Indoor node (for cat-in-house routes). */
  indoor?: boolean;
}

export interface CatEdge {
  a: string;
  b: string;
  /** Edge requires a jump animation. */
  jump?: boolean;
  /** Edge goes through a door: only usable when this door is open (unless flap). */
  door?: string;
  /** Edge uses the dog flap of this door. */
  flap?: string;
}

export interface Spawn {
  x: number;
  z: number;
  facing: number;
}
