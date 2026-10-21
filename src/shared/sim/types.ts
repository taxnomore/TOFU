// Game state shapes. Plain JSON-friendly objects so snapshots serialize easily.
import type { MessKind } from '../world/itemTypes';

export type Role = 'tofu' | 'human';
export type Winner = 'tofu' | 'humans';

export interface PlayerSlot {
  role: Role;
  name: string;
  /** Human look (0..3). Ignored for Tofu. */
  avatar: number;
  ai: boolean;
}

export interface GameConfig {
  seed: number;
  duration: number;
  players: PlayerSlot[];
  chaosGoal?: number;
  cleanGoal?: number;
  /** AI difficulty 0 (easy) .. 2 (hard). */
  difficulty?: number;
  /** Skip the 3-2-1 countdown (tests). */
  noCountdown?: boolean;
}

export interface InputFrame {
  /** World-space movement (already rotated by the camera), length <= 1. */
  mx: number;
  mz: number;
  buttons: number;
}

export const EMPTY_INPUT: InputFrame = { mx: 0, mz: 0, buttons: 0 };

export const Anim = {
  Idle: 0,
  Walk: 1,
  Run: 2,
  Sit: 3,
  Bark: 4,
  Interact: 5,
  Clean: 6,
  Push: 7,
  Eat: 8,
  Slip: 9,
  Boop: 10,
  Throw: 11,
  Jump: 12,
  Cheer: 13,
  Sad: 14,
  Dig: 15,
  Pet: 16,
} as const;
export type Anim = (typeof Anim)[keyof typeof Anim];

export interface ActionState {
  kind: string;
  target: number;
  t: number;
  dur: number;
}

export interface Character {
  id: number;
  role: Role;
  name: string;
  avatar: number;
  ai: boolean;
  x: number;
  z: number;
  vx: number;
  vz: number;
  facing: number;
  speed: number;
  stamina: number;
  sprinting: boolean;
  exhausted: boolean;
  hold: number[];
  act: ActionState | null;
  anim: Anim;
  animT: number;
  lastButtons: number;
  idleT: number;
  /** One-shot animation lock (bark, throw, eat...). */
  lockT: number;
  // Dog
  mud: number;
  zoom: number;
  zoomT: number;
  pantT: number;
  barkCd: number;
  sitT: number;
  lureKind: '' | 'treat' | 'ball';
  lureIdx: number;
  lureT: number;
  lureImmune: number;
  noPickup: number;
  stun: number;
  printAcc: number;
  printSide: number;
  bedCd: number;
  innocentDone: number[];
  recentMischief: string[];
  // Human
  treats: number;
  throwCd: number;
  treatJarCd: number;
  slipCd: number;
  startleCd: number;
  takeCd: number;
  /** Speech bubble (short French text) and its timer. */
  say: string;
  sayT: number;
}

export type ItemState = 'home' | 'free' | 'held' | 'stored' | 'air' | 'knocked' | 'gone';

export interface Item {
  idx: number;
  id: string;
  type: string;
  state: ItemState;
  x: number;
  y: number;
  z: number;
  rot: number;
  /** Tilt when lying (radians) for visuals. */
  tilt: number;
  vx: number;
  vy: number;
  vz: number;
  spin: number;
  holder: number;
  station: number;
  /** Slot index inside the station (fixed visual position). */
  slot: number;
  bounces: number;
  disturbed: boolean;
  mess: number;
  knockCd: number;
  homeX: number;
  homeY: number;
  homeZ: number;
  homeRot: number;
  /** Zone id where Tofu grabbed it (for "carry to the street"). */
  grabbedIn: string;
  lastStealT: number;
  stashed: boolean;
  streetScored: boolean;
  /** Watering can water units / ripped bag flag. */
  charge: number;
  respawnT: number;
  /** Who knocked / threw it (char id) for chaos attribution; -2 = cat. */
  by: number;
  rev: number;
}

export interface Mess {
  id: number;
  kind: MessKind;
  x: number;
  z: number;
  r: number;
  zone: string;
  progress: number;
  item: number;
  station: number;
  /** Mud prints: flat [x, z, rot, ...]. */
  prints: number[];
  seed: number;
  /** Created by Tofu (for innocent-sit objective). */
  byTofu: boolean;
  age: number;
  rev: number;
}

export interface StationState {
  idx: number;
  items: number[];
  made: boolean;
  watered: boolean;
  dug: boolean;
  disabled: boolean;
  rev: number;
}

export interface DoorState {
  idx: number;
  open: boolean;
  push: number;
  rev: number;
}

export interface Treat {
  id: number;
  owner: number;
  x: number;
  y: number;
  z: number;
  vx: number;
  vy: number;
  vz: number;
  landed: boolean;
  landT: number;
}

export type CatMode = 'idle' | 'walk' | 'flee' | 'perched' | 'hiss';

export interface CatState {
  x: number;
  y: number;
  z: number;
  facing: number;
  mode: CatMode;
  node: number;
  path: number[];
  edgeFrom: number;
  edgeTo: number;
  edgeT: number;
  edgeLen: number;
  jump: boolean;
  timer: number;
  chaseAcc: number;
  fleeChaos: number;
  barkCd: number;
  hissT: number;
  speed: number;
  stuckT: number;
}

export interface CarrierState {
  active: boolean;
  x: number;
  z: number;
  facing: number;
  t: number;
  wait: number;
  barkCd: number;
  scared: number;
  next: number;
}

export type TaskKind = 'linge' | 'jouets' | 'table' | 'gouter' | 'poubelle' | 'courrier' | 'lit' | 'fleurs';

export interface TaskState {
  kind: TaskKind;
  done: boolean;
  progress: number;
  total: number;
}

export interface SecretState {
  id: string;
  progress: number;
  goal: number;
  done: boolean;
}

export interface Stats {
  laundryStolen: number;
  itemsStolen: number;
  knocks: number;
  binsTipped: number;
  mudPrints: number;
  catChase: number;
  barks: number;
  eaten: number;
  stashed: number;
  messesCleaned: number;
  recovered: number;
  pawsWiped: number;
  treatsThrown: number;
  slips: number;
  doorsClosed: number;
  zoomies: number;
  tofuDistance: number;
  humanAccidents: number;
  tasksDone: number;
  startles: number;
}

export type Phase = 'countdown' | 'play' | 'end';

export interface GameState {
  phase: Phase;
  tick: number;
  time: number;
  duration: number;
  countdown: number;
  chaos: number;
  chaosGoal: number;
  cleanliness: number;
  cleanGoal: number;
  guestsT: number;
  winner: Winner | null;
  endReason: string;
  chars: Character[];
  items: Item[];
  messes: Mess[];
  stations: StationState[];
  doors: DoorState[];
  treats: Treat[];
  cat: CatState;
  carrier: CarrierState;
  tasks: TaskState[];
  secrets: SecretState[];
  stats: Stats;
  /** Per-character stats for the end screen. */
  charStats: Record<number, Record<string, number>>;
  nextMessId: number;
  nextTreatId: number;
  rngState: number;
}

export type GameEvent =
  | { t: 'chaos'; amount: number; reason: string; x: number; z: number }
  | { t: 'bark'; id: number }
  | { t: 'pickup'; id: number; item: number }
  | { t: 'drop'; id: number; item: number }
  | { t: 'store'; id: number; item: number; station: number }
  | { t: 'steal'; id: number; item: number; x: number; z: number }
  | { t: 'recover'; id: number; item: number }
  | { t: 'knock'; item: number; by: number; x: number; z: number }
  | { t: 'land'; item: number; x: number; z: number; hard: boolean }
  | { t: 'mess'; mess: number; kind: MessKind; x: number; z: number; zone: string }
  | { t: 'cleaned'; mess: number; kind: MessKind; by: number; x: number; z: number }
  | { t: 'door'; door: number; open: boolean; by: number }
  | { t: 'muddy'; id: number }
  | { t: 'paws'; by: number }
  | { t: 'cat'; what: 'flee' | 'hiss' | 'boop' | 'meow' | 'perch'; x: number; z: number }
  | { t: 'zoomies'; id: number; on: boolean }
  | { t: 'treat'; by: number; x: number; z: number }
  | { t: 'lured'; id: number; kind: 'treat' | 'ball' }
  | { t: 'eat'; id: number; item: number }
  | { t: 'throw'; id: number; item: number }
  | { t: 'slip'; id: number }
  | { t: 'task'; idx: number; done: boolean }
  | { t: 'secret'; idx: number }
  | { t: 'guests'; on: boolean }
  | { t: 'startle'; id: number; by: number }
  | { t: 'bed'; made: boolean }
  | { t: 'water'; station: number }
  | { t: 'dig'; station: number }
  | { t: 'innocent'; id: number }
  | { t: 'say'; id: number; text: string }
  | { t: 'pet'; id: number }
  | { t: 'carrier'; what: 'arrive' | 'scared' | 'leave' }
  | { t: 'end'; winner: Winner; reason: string }
  | { t: 'go' };
