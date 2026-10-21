import { StationKind } from './types';

export type ItemCategory = 'laundry' | 'toy' | 'food' | 'paper' | 'trash' | 'dishes' | 'ball' | 'tool' | 'knockable' | 'roll' | 'market';

export type MessKind =
  | 'water' | 'soil' | 'blocks' | 'cushion' | 'trash' | 'gnome' | 'mud' | 'crumbs' | 'shards' | 'dig'
  | 'muddy_bed' | 'muddy_sofa' | 'paper' | 'wet' | 'leaves' | 'leaf_trail' | 'snow' | 'apples' | 'coffee';

/** Messes made of many small marks along a path (paw prints, paper strips, drops). */
export const TRAIL_KINDS: readonly MessKind[] = ['mud', 'paper', 'wet', 'leaf_trail'];

export function isTrail(kind: MessKind): boolean {
  return TRAIL_KINDS.includes(kind);
}

export interface KnockDef {
  mess: MessKind;
  chaos: number;
  /** Minimum bump speed (m/s) to tip it by running into it. */
  minSpeed: number;
  /** Seconds Tofu must hold interact to tip it on purpose (heavy items). 0 = instant nudge. */
  push: number;
  /** Visual resting pose once knocked. */
  lie: 'side' | 'flat' | 'scatter';
  /** Height of the object (for tumble visuals). */
  height: number;
  /** Chaos message (default: "<Objet> renversé !"). */
  text?: string;
}

export interface ItemTypeDef {
  /** French name with article. */
  name: string;
  /** Short French noun for prompts. */
  short: string;
  category: ItemCategory;
  icon: string;
  carry?: { dog: boolean; human: boolean; stack: number; slow: number };
  knock?: KnockDef;
  edible?: boolean;
  /** Stations where the item counts as tidy (not misplaced). */
  homes?: StationKind[];
  /** Never counts as a misplaced object. */
  neverMess?: boolean;
  /** Approximate radius (pickup reach + visuals). */
  size: number;
  /** Station id where the item comes back after being eaten or used up. */
  respawnAt?: string;
}

const LAUNDRY_HOMES: StationKind[] = ['hamper', 'dresser', 'clothesline'];

export const ITEM_TYPES: Record<string, ItemTypeDef> = {
  sock: { name: 'la chaussette', short: 'chaussette', category: 'laundry', icon: '🧦', size: 0.15,
    carry: { dog: true, human: true, stack: 3, slow: 0.02 }, homes: LAUNDRY_HOMES },
  sock2: { name: 'la chaussette rayée', short: 'chaussette', category: 'laundry', icon: '🧦', size: 0.15,
    carry: { dog: true, human: true, stack: 3, slow: 0.02 }, homes: LAUNDRY_HOMES },
  underwear: { name: 'le slip à pois', short: 'slip à pois', category: 'laundry', icon: '🩲', size: 0.18,
    carry: { dog: true, human: true, stack: 3, slow: 0.02 }, homes: LAUNDRY_HOMES },
  tshirt: { name: 'la marinière', short: 'marinière', category: 'laundry', icon: '👕', size: 0.25,
    carry: { dog: true, human: true, stack: 3, slow: 0.03 }, homes: LAUNDRY_HOMES },
  towel: { name: 'la serviette', short: 'serviette', category: 'laundry', icon: '🧺', size: 0.25,
    carry: { dog: true, human: true, stack: 3, slow: 0.03 }, homes: LAUNDRY_HOMES },
  slipper: { name: 'le chausson', short: 'chausson', category: 'laundry', icon: '🥿', size: 0.16,
    carry: { dog: true, human: true, stack: 3, slow: 0.02 }, homes: ['bedside', 'shoe_rack', 'hamper', 'dresser'] },
  teddy: { name: 'le nounours', short: 'nounours', category: 'toy', icon: '🧸', size: 0.2,
    carry: { dog: true, human: true, stack: 3, slow: 0.02 }, homes: ['toybox'] },
  toycar: { name: 'la petite voiture', short: 'petite voiture', category: 'toy', icon: '🚗', size: 0.16,
    carry: { dog: true, human: true, stack: 3, slow: 0.02 }, homes: ['toybox'] },
  duck: { name: 'le canard en plastique', short: 'canard', category: 'toy', icon: '🦆', size: 0.14,
    carry: { dog: true, human: true, stack: 3, slow: 0.02 }, homes: ['toybox'] },
  dino: { name: 'le dinosaure', short: 'dinosaure', category: 'toy', icon: '🦖', size: 0.18,
    carry: { dog: true, human: true, stack: 3, slow: 0.02 }, homes: ['toybox'] },
  croissants: { name: 'le sachet de croissants', short: 'croissants', category: 'food', icon: '🥐', size: 0.2,
    carry: { dog: true, human: true, stack: 1, slow: 0.02 }, edible: true, homes: ['counter', 'garden_table', 'bakery'] },
  baguette: { name: 'la baguette', short: 'baguette', category: 'food', icon: '🥖', size: 0.35,
    carry: { dog: true, human: true, stack: 1, slow: 0.03 }, edible: true, homes: ['bakery', 'counter', 'garden_table'], respawnAt: 'boulangerie' },
  toilet_roll: { name: 'le rouleau de papier toilette', short: 'papier toilette', category: 'roll', icon: '🧻', size: 0.12,
    carry: { dog: true, human: true, stack: 2, slow: 0.01 }, homes: ['roll_holder'], respawnAt: 'derouleur' },
  letter: { name: 'le courrier', short: 'courrier', category: 'paper', icon: '✉️', size: 0.15,
    carry: { dog: true, human: true, stack: 3, slow: 0 }, homes: ['mailbox', 'console'] },
  trash_bag: { name: 'le sac poubelle', short: 'sac poubelle', category: 'trash', icon: '🗑️', size: 0.3,
    carry: { dog: false, human: true, stack: 1, slow: 0.12 }, homes: ['street_bin'] },
  dishes: { name: 'la vaisselle', short: 'vaisselle', category: 'dishes', icon: '🍽️', size: 0.25,
    carry: { dog: false, human: true, stack: 1, slow: 0.08 }, homes: ['cupboard', 'dining_table'] },
  ball: { name: 'la balle', short: 'balle', category: 'ball', icon: '🎾', size: 0.1,
    carry: { dog: true, human: true, stack: 1, slow: 0 }, neverMess: true },
  // Tofu can steal it too: carried by him, it leaks all over the floor.
  watering_can: { name: "l'arrosoir", short: 'arrosoir', category: 'tool', icon: '🚿', size: 0.25,
    carry: { dog: true, human: true, stack: 1, slow: 0.1 }, neverMess: true },
  // Market day (on the stalls of the square).
  saucisson: { name: 'le saucisson', short: 'saucisson', category: 'market', icon: '🌭', size: 0.18,
    carry: { dog: true, human: true, stack: 1, slow: 0.02 }, edible: true, homes: ['market'], respawnAt: 'etal_charcuterie' },
  fromage: { name: 'le fromage', short: 'fromage', category: 'market', icon: '🧀', size: 0.18,
    carry: { dog: true, human: true, stack: 1, slow: 0.02 }, edible: true, homes: ['market'], respawnAt: 'etal_fromage' },
  poulet: { name: 'le poulet rôti', short: 'poulet rôti', category: 'market', icon: '🍗', size: 0.2,
    carry: { dog: true, human: true, stack: 1, slow: 0.03 }, edible: true, homes: ['market'], respawnAt: 'etal_volaille' },

  vase: { name: 'le vase de fleurs', short: 'vase', category: 'knockable', icon: '🏺', size: 0.18,
    knock: { mess: 'water', chaos: 4, minSpeed: 0.8, push: 0, lie: 'side', height: 0.4 } },
  plant: { name: 'la plante verte', short: 'plante', category: 'knockable', icon: '🪴', size: 0.3,
    knock: { mess: 'soil', chaos: 4, minSpeed: 1.2, push: 0, lie: 'side', height: 0.9 } },
  flowerpot: { name: 'le pot de fleurs', short: 'pot de fleurs', category: 'knockable', icon: '🌷', size: 0.22,
    knock: { mess: 'soil', chaos: 3, minSpeed: 1.0, push: 0, lie: 'side', height: 0.45 } },
  toy_tower: { name: 'la tour de cubes', short: 'tour de cubes', category: 'knockable', icon: '🧱', size: 0.25,
    knock: { mess: 'blocks', chaos: 3, minSpeed: 0.5, push: 0, lie: 'scatter', height: 0.7 } },
  cushion: { name: 'le coussin', short: 'coussin', category: 'knockable', icon: '🛋️', size: 0.25,
    knock: { mess: 'cushion', chaos: 1.5, minSpeed: 99, push: 0, lie: 'flat', height: 0.4 } },
  kitchen_bin: { name: 'la poubelle de la cuisine', short: 'poubelle', category: 'knockable', icon: '🗑️', size: 0.22,
    knock: { mess: 'trash', chaos: 5, minSpeed: 1.6, push: 0, lie: 'side', height: 0.6 } },
  wheelie_bin: { name: 'la grande poubelle', short: 'poubelle', category: 'knockable', icon: '🗑️', size: 0.35,
    knock: { mess: 'trash', chaos: 5, minSpeed: 6.0, push: 0.7, lie: 'side', height: 1.05 } },
  public_bin: { name: 'la poubelle du square', short: 'poubelle', category: 'knockable', icon: '🗑️', size: 0.25,
    knock: { mess: 'trash', chaos: 4, minSpeed: 2.0, push: 0, lie: 'side', height: 0.8 } },
  gnome: { name: 'le nain de jardin', short: 'nain de jardin', category: 'knockable', icon: '🧙', size: 0.2,
    knock: { mess: 'gnome', chaos: 3, minSpeed: 0.8, push: 0, lie: 'side', height: 0.55 } },
  watering_pot: { name: "le seau d'eau", short: 'seau', category: 'knockable', icon: '🪣', size: 0.2,
    knock: { mess: 'water', chaos: 2.5, minSpeed: 0.8, push: 0, lie: 'side', height: 0.35 } },
  // Up high, out of Tofu's reach: the cat (or a ball) knocks them down.
  mug: { name: 'la tasse de café', short: 'tasse', category: 'knockable', icon: '☕', size: 0.08,
    knock: { mess: 'coffee', chaos: 3, minSpeed: 0.5, push: 0, lie: 'scatter', height: 0.12, text: 'La tasse de café ! Patatras !' } },
  herb_pot: { name: 'le pot de basilic', short: 'pot de basilic', category: 'knockable', icon: '🌿', size: 0.12,
    knock: { mess: 'soil', chaos: 3, minSpeed: 0.8, push: 0, lie: 'side', height: 0.25 } },
  // Autumn: running through a pile scatters it.
  leaf_pile: { name: 'le tas de feuilles', short: 'tas de feuilles', category: 'knockable', icon: '🍂', size: 0.45,
    knock: { mess: 'leaves', chaos: 2.5, minSpeed: 0.3, push: 0, lie: 'scatter', height: 0.35, text: 'Tas de feuilles éparpillé !' } },
  // Winter: heavy, Tofu pushes it over (or runs into it at full speed).
  snowman: { name: 'le bonhomme de neige', short: 'bonhomme de neige', category: 'knockable', icon: '⛄', size: 0.42,
    knock: { mess: 'snow', chaos: 5, minSpeed: 6.5, push: 0.8, lie: 'scatter', height: 1.25, text: 'Bonhomme de neige démoli !' } },
  // Market day.
  apple_crate: { name: 'le cageot de pommes', short: 'cageot de pommes', category: 'knockable', icon: '🍎', size: 0.3,
    knock: { mess: 'apples', chaos: 4, minSpeed: 1.2, push: 0, lie: 'side', height: 0.3, text: 'Les pommes roulent partout !' } },
};

export interface MessTypeDef {
  name: string;
  /** Cleanliness points removed while the mess exists. */
  dirt: number;
  /** Seconds of cleaning for one human. */
  clean: number;
  icon: string;
  verb: string;
  /** Wet floor: sprinting humans can slip on it. */
  slippery?: boolean;
}

export const MESS_TYPES: Record<MessKind, MessTypeDef> = {
  water: { name: "de l'eau renversée", dirt: 6, clean: 1.8, icon: '💧', verb: 'Éponger', slippery: true },
  soil: { name: 'de la terre renversée', dirt: 7, clean: 2.2, icon: '🪴', verb: 'Ramasser la terre' },
  blocks: { name: 'des cubes éparpillés', dirt: 5, clean: 1.8, icon: '🧱', verb: 'Empiler les cubes' },
  cushion: { name: 'un coussin par terre', dirt: 3, clean: 0.7, icon: '🛋️', verb: 'Remettre le coussin' },
  trash: { name: 'des déchets renversés', dirt: 8, clean: 2.5, icon: '🗑️', verb: 'Ramasser les déchets' },
  gnome: { name: 'un nain de jardin renversé', dirt: 3, clean: 0.8, icon: '🧙', verb: 'Relever le nain' },
  mud: { name: 'des traces de boue', dirt: 4, clean: 1.4, icon: '🐾', verb: 'Essuyer la boue', slippery: true },
  crumbs: { name: 'des miettes', dirt: 3, clean: 1.0, icon: '🥐', verb: 'Balayer les miettes' },
  shards: { name: 'de la vaisselle par terre', dirt: 8, clean: 2.4, icon: '🍽️', verb: 'Ramasser la vaisselle' },
  dig: { name: 'un trou dans le massif', dirt: 6, clean: 2.0, icon: '🕳️', verb: 'Reboucher le trou' },
  muddy_bed: { name: 'des draps boueux', dirt: 7, clean: 2.2, icon: '🛏️', verb: 'Changer les draps' },
  muddy_sofa: { name: 'un canapé boueux', dirt: 7, clean: 2.2, icon: '🛋️', verb: 'Brosser le canapé' },
  paper: { name: 'du papier toilette déroulé', dirt: 4, clean: 1.2, icon: '🧻', verb: 'Ramasser le papier' },
  wet: { name: "des traces d'eau", dirt: 3, clean: 1.0, icon: '💧', verb: 'Éponger les traces', slippery: true },
  leaves: { name: 'des feuilles éparpillées', dirt: 4, clean: 2.0, icon: '🍂', verb: 'Ratisser les feuilles' },
  leaf_trail: { name: 'des feuilles dans la maison', dirt: 3, clean: 1.0, icon: '🍂', verb: 'Ramasser les feuilles' },
  snow: { name: 'un bonhomme de neige démoli', dirt: 4, clean: 2.5, icon: '⛄', verb: 'Refaire le bonhomme' },
  apples: { name: 'des pommes par terre', dirt: 5, clean: 1.8, icon: '🍎', verb: 'Ramasser les pommes', slippery: true },
  coffee: { name: 'du café renversé', dirt: 5, clean: 1.6, icon: '☕', verb: 'Éponger le café', slippery: true },
};
