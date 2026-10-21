// Gameplay tuning. All balance numbers live here so they are easy to adjust.

export const SIM_HZ = 60;
export const SIM_DT = 1 / SIM_HZ;

export const DEFAULT_DURATION = 360;
export const COUNTDOWN_TIME = 3;
export const GUESTS_COUNTDOWN = 15;

export const CHAOS_GOAL = 200;
/** Chaos goal by number of humans (2 humans clean up faster). */
export const CHAOS_GOAL_BY_HUMANS = [250, 250, 180];
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
  carrySlow: 0.14,
  /** Highest object Tofu can knock over on purpose (higher up: only the cat). */
  knockReachY: 0.9,
  /** Paw dirt from walking in the snow (winter). */
  snowPaws: 0.3,
  /** Paw dirt from jumping into a pile of leaves (autumn). */
  leafPaws: 0.55,
  /** Dirt lost per leaf dropped indoors (leaves fall off faster than mud). */
  leafPerPrint: 0.05,
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
  steal: 2,
  stealRepeatWindow: 60,
  stash: 3,
  streetDrop: 4,
  eat: 7,
  ripBag: 4,
  bedJump: 3,
  muddyBed: 4,
  sofaJump: 1.5,
  muddySofa: 4,
  dig: 4,
  tablecloth: 7,
  print: 0.15,
  /** Wet print of snowy paws (winter): they dry up anyway. */
  wetPrint: 0.06,
  chasePerSec: 1.2,
  chaseCapPerFlee: 6,
  barkCat: 2,
  barkCatCd: 6,
  barkCarrier: 3,
  boop: 1,
  humanSlip: 1.5,
  /** Multiplier when a human or the cat knocks something (accident). */
  accidentMul: 0.5,
  catAccidentMul: 0.6,
  /** Passive chaos per second for each mess left uncleaned. */
  messDrip: 0.012,
  messDripCap: 0.12,
  secret: 20,
  innocent: 2,
  /** Each strip of toilet paper unrolled by Tofu. */
  paper: 0.15,
  /** Tofu switches the robot vacuum on. */
  vacuum: 1.5,
  /** Goods stolen from a market stall (instead of `steal`). */
  marketSteal: 3,
};

/** Watering can stolen by Tofu: it leaks behind him. */
export const CAN = {
  /** Distance between two drops (m). */
  dripSpacing: 0.4,
  /** Water used per drop (a full can holds 2: 20 drops). */
  perDrip: 0.1,
  /** Chaos per drop left on a floor. */
  dripChaos: 0.08,
};

/** Water marks (leaking can, snowy paws) dry up on their own. */
export const WET = {
  /** Age (s) of a trail cell before it starts drying. */
  dryAfter: 25,
  /** One mark dries every this many seconds. */
  dryEvery: 2.5,
};

/** Robot vacuum of the living room. */
export const VACUUM = {
  radius: 0.2,
  speed: 1.1,
  /** Seconds of wandering once switched on. */
  runTime: 25,
  /** Seconds to drive back home before it teleports onto its dock. */
  homeTime: 12,
  /** Charging time on the dock before it can run again. */
  rest: 20,
  /** Cat runs away when the vacuum gets this close. */
  catFear: 2.2,
};

/** Toilet paper: a carried roll unrolls behind Tofu. */
export const PAPER = {
  /** Strips in a full roll. */
  length: 30,
  /** Distance between two strips (m). */
  spacing: 0.34,
  /** A used-up roll comes back on its holder after this delay (s). */
  respawn: 40,
  /** Strips for a fully dirty paper cell. */
  fullStrips: 6,
};

/** Zoomies meter gain per mischief type (diminishing for repeats). */
export const ZOOM_GAIN: Record<string, number> = {
  steal: 0.1,
  stash: 0.08,
  knock: 0.13,
  bin: 0.14,
  eat: 0.14,
  mud: 0.12,
  chase: 0.15,
  bark: 0.02,
  bed: 0.1,
  dig: 0.12,
  tablecloth: 0.16,
  treat: 0.08,
  street: 0.1,
  paper: 0.1,
  vacuum: 0.12,
  leaves: 0.12,
  drip: 0.1,
};

export const CLEANLINESS = {
  misplacedItem: 2.5,
  outdoorFactor: 0.7,
  outsideFactor: 0.45,
  mudFullPrints: 5,
};

/** Number of household jobs per round according to the human count. */
export const TASKS_PER_HUMANS = [0, 3, 6];

export const KNOCK_RESTORE_CD = 14;
/** Protection after a human recovers an object or puts it back in place. */
export const GUARD_TIME = 25;
export const BAKERY_BUY_TIME = 1.4;
export const BAGUETTE_RESPAWN = 45;
