// Gameplay tuning. All balance numbers live here so they are easy to adjust.

export const SIM_HZ = 60;
export const SIM_DT = 1 / SIM_HZ;

export const DEFAULT_DURATION = 360;
export const COUNTDOWN_TIME = 3;
export const GUESTS_COUNTDOWN = 8;

export const CHAOS_GOAL = 100;
export const CLEAN_GOAL = 70;

export const BTN_INTERACT = 1;
export const BTN_SPRINT = 2;
export const BTN_SPECIAL = 4;
export const BTN_BARK = 8;
export const BTN_SIT = 16;
export const BTN_ALL = 31;

export const HUMAN = {
  radius: 0.34,
  walk: 3.75,
  sprint: 5.7,
  accel: 30,
  turn: 13,
  staminaDrain: 0.24,
  staminaRegen: 0.2,
  staminaMinStart: 0.12,
  reach: 1.15,
  carryMax: 3,
  treatsStart: 2,
  treatsMax: 3,
  treatThrowCd: 1.0,
  treatRefillCd: 15,
  slipTime: 1.15,
  slipCd: 3.5,
  /** Sprint speed above which a human can knock things or slip. */
  clumsySpeed: 4.9,
  takeCd: 0.6,
};

export const DOG = {
  radius: 0.3,
  walk: 4.15,
  sprint: 6.7,
  zoomies: 8.6,
  accel: 36,
  turn: 16,
  staminaDrain: 0.33,
  staminaRegen: 0.23,
  sitRegenMul: 2.2,
  staminaMinStart: 0.15,
  reach: 0.95,
  barkCd: 0.9,
  pushDoorTime: 0.9,
  zoomiesTime: 6.0,
  pantTime: 1.4,
  printSpacing: 0.42,
  mudPerPrint: 0.034,
  mudDecayOutdoor: 0.012,
  noPickupAfterTake: 2.2,
  lureMaxTime: 3.5,
  lureImmunity: 8,
  lureTreatRange: 9,
  lureBallRange: 12,
  treatTrapRange: 2.6,
  eatTime: 2.0,
  idleSitDelay: 2.5,
  innocentTime: 2.0,
  boopStun: 0.6,
  bedJumpCd: 6,
  carrySlow: 0.05,
};

export const CAT = {
  radius: 0.18,
  walk: 1.5,
  flee: 6.9,
  jumpTime: 0.45,
  fearRadius: 5.5,
  fearRadiusSprint: 8.5,
  boopRadius: 0.7,
  perchRest: [4, 9] as const,
  idleRest: [2, 6] as const,
  bumpRadius: 0.5,
};

/** Chaos points awarded to Tofu. */
export const CHAOS = {
  steal: 4,
  stealRepeatWindow: 25,
  stash: 6,
  streetDrop: 6,
  eat: 9,
  ripBag: 6,
  bedJump: 4,
  muddyBed: 5,
  sofaJump: 2,
  muddySofa: 5,
  dig: 5,
  tablecloth: 9,
  print: 0.35,
  chasePerSec: 1.7,
  chaseCapPerFlee: 10,
  barkCat: 3,
  barkCatCd: 4,
  barkCarrier: 4,
  boop: 2,
  humanSlip: 2,
  /** Multiplier when a human or the cat knocks something (accident). */
  accidentMul: 0.5,
  catAccidentMul: 0.6,
  /** Passive chaos per second for each mess left uncleaned. */
  messDrip: 0.022,
  messDripCap: 0.25,
  secret: 15,
  innocent: 3,
};

/** Zoomies meter gain per mischief type (diminishing for repeats). */
export const ZOOM_GAIN: Record<string, number> = {
  steal: 0.16,
  stash: 0.14,
  knock: 0.2,
  bin: 0.22,
  eat: 0.2,
  mud: 0.18,
  chase: 0.22,
  bark: 0.03,
  bed: 0.16,
  dig: 0.18,
  tablecloth: 0.25,
  treat: 0.12,
  street: 0.16,
};

export const CLEANLINESS = {
  misplacedItem: 2.5,
  outdoorFactor: 0.7,
  outsideFactor: 0.45,
  mudFullPrints: 5,
};

/** Number of household jobs per round according to the human count. */
export const TASKS_PER_HUMANS = [0, 4, 6];

export const KNOCK_RESTORE_CD = 14;
export const BAKERY_BUY_TIME = 1.4;
export const BAGUETTE_RESPAWN = 45;
