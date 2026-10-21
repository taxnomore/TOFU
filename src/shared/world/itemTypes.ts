import { StationKind } from './types';

export type ItemCategory = 'laundry' | 'toy' | 'food' | 'paper' | 'trash' | 'dishes' | 'ball' | 'tool' | 'knockable' | 'roll' | 'market' | 'gift';

export type MessKind =
  | 'water' | 'soil' | 'blocks' | 'cushion' | 'trash' | 'gnome' | 'mud' | 'crumbs' | 'shards' | 'dig'
  | 'muddy_bed' | 'muddy_sofa' | 'paper' | 'wet' | 'leaves' | 'leaf_trail' | 'snow' | 'apples' | 'coffee' | 'muddy_cushions'
  | 'muddy_blanket' | 'paint' | 'books' | 'mannequin' | 'cans' | 'cart' | 'lemonade';

/** Dirty-paws messes on "make" stations (bed, reading corner, picnic blanket). */
export const MAKE_MESSES: ReadonlySet<MessKind> = new Set<MessKind>(['muddy_bed', 'muddy_cushions', 'muddy_blanket']);

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
  /** Tofu can tear it open on the floor (trash bag, cardboard). */
  rip?: { verb: string; text: string };
}

const LAUNDRY_HOMES: StationKind[] = ['hamper', 'dresser', 'clothesline', 'coat_hooks', 'clothes_rack'];
/** Lost clothes of the school: the lost-and-found box or the coat hooks. */
const SCHOOL_CLOTHES: StationKind[] = ['hamper', 'coat_hooks'];
/** Clothes of the shop. */
const SHOP_CLOTHES: StationKind[] = ['clothes_rack'];
const CLOTHES = { dog: true, human: true, stack: 3, slow: 0.02 };
const TOY = { dog: true, human: true, stack: 3, slow: 0.02 };
const TOY_HOMES: StationKind[] = ['toybox', 'shop_shelf'];

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
    carry: { dog: true, human: true, stack: 3, slow: 0.02 }, homes: TOY_HOMES },
  toycar: { name: 'la petite voiture', short: 'petite voiture', category: 'toy', icon: '🚗', size: 0.16,
    carry: { dog: true, human: true, stack: 3, slow: 0.02 }, homes: TOY_HOMES },
  duck: { name: 'le canard en plastique', short: 'canard', category: 'toy', icon: '🦆', size: 0.14,
    carry: { dog: true, human: true, stack: 3, slow: 0.02 }, homes: TOY_HOMES },
  dino: { name: 'le dinosaure', short: 'dinosaure', category: 'toy', icon: '🦖', size: 0.18,
    carry: { dog: true, human: true, stack: 3, slow: 0.02 }, homes: TOY_HOMES },
  // École: lost clothes, school supplies, balls, the poster of the party.
  beanie: { name: 'le bonnet', short: 'bonnet', category: 'laundry', icon: '🧶', size: 0.14, carry: CLOTHES, homes: SCHOOL_CLOTHES },
  scarf: { name: "l'écharpe", short: 'écharpe', category: 'laundry', icon: '🧣', size: 0.2, carry: CLOTHES, homes: SCHOOL_CLOTHES },
  mitten: { name: 'la moufle', short: 'moufle', category: 'laundry', icon: '🧤', size: 0.12, carry: CLOTHES, homes: SCHOOL_CLOTHES },
  cardigan: { name: 'le gilet', short: 'gilet', category: 'laundry', icon: '🧥', size: 0.24, carry: CLOTHES, homes: SCHOOL_CLOTHES },
  pencil_pot: { name: 'le pot de crayons', short: 'pot de crayons', category: 'toy', icon: '✏️', size: 0.1, carry: TOY, homes: ['cabinet'] },
  glue: { name: 'le tube de colle', short: 'colle', category: 'toy', icon: '🧴', size: 0.08, carry: TOY, homes: ['cabinet'] },
  paint_box: { name: 'la boîte de peinture', short: 'boîte de peinture', category: 'toy', icon: '🎨', size: 0.14, carry: TOY, homes: ['cabinet'] },
  notebook: { name: 'le cahier', short: 'cahier', category: 'toy', icon: '📒', size: 0.13, carry: TOY, homes: ['cabinet'] },
  football: { name: 'le ballon de foot', short: 'ballon de foot', category: 'toy', icon: '⚽', size: 0.13, carry: TOY, homes: ['toybox'] },
  basketball: { name: 'le ballon de basket', short: 'ballon de basket', category: 'toy', icon: '🏀', size: 0.14, carry: TOY, homes: ['toybox'] },
  poster: { name: "l'affiche de la fête", short: 'affiche', category: 'paper', icon: '📜', size: 0.18,
    carry: { dog: true, human: true, stack: 1, slow: 0 }, homes: ['notice_board', 'counter'] },
  cake: { name: 'le gâteau au chocolat', short: 'gâteau', category: 'food', icon: '🎂', size: 0.2,
    carry: { dog: true, human: true, stack: 1, slow: 0.03 }, edible: true, homes: ['counter', 'garden_table', 'gift_table', 'bakery'] },
  // Centre commercial: clothes of the boutique, cardboard, cash box.
  dress: { name: 'la robe à fleurs', short: 'robe', category: 'laundry', icon: '👗', size: 0.25, carry: CLOTHES, homes: SHOP_CLOTHES },
  jeans: { name: 'le jean', short: 'jean', category: 'laundry', icon: '👖', size: 0.25, carry: CLOTHES, homes: SHOP_CLOTHES },
  hat: { name: 'le chapeau de paille', short: 'chapeau', category: 'laundry', icon: '👒', size: 0.18, carry: CLOTHES, homes: [...SHOP_CLOTHES, 'coat_hooks'] },
  cap: { name: 'la casquette', short: 'casquette', category: 'laundry', icon: '🧢', size: 0.14, carry: CLOTHES, homes: [...SHOP_CLOTHES, 'coat_hooks', 'hamper'] },
  cardboard: { name: 'la pile de cartons', short: 'cartons', category: 'trash', icon: '📦', size: 0.32,
    carry: { dog: false, human: true, stack: 1, slow: 0.12 }, homes: ['street_bin'],
    rip: { verb: 'Déchiqueter les cartons', text: 'Cartons déchiquetés !' } },
  cash_box: { name: 'le fond de caisse', short: 'fond de caisse', category: 'paper', icon: '💶', size: 0.14,
    carry: { dog: true, human: true, stack: 1, slow: 0.02 }, homes: ['checkout', 'cupboard'] },
  // Parc: presents, beach toys.
  gift: { name: 'le cadeau', short: 'cadeau', category: 'gift', icon: '🎁', size: 0.17,
    carry: { dog: true, human: true, stack: 2, slow: 0.03 }, homes: ['gift_table', 'cupboard'] },
  sand_bucket: { name: 'le seau de plage', short: 'seau', category: 'toy', icon: '🪣', size: 0.12, carry: TOY, homes: ['toybox'] },
  shovel: { name: 'la pelle', short: 'pelle', category: 'toy', icon: '⛏️', size: 0.15, carry: TOY, homes: ['toybox'] },
  beach_ball: { name: 'le ballon de plage', short: 'ballon de plage', category: 'toy', icon: '🏐', size: 0.16, carry: TOY, homes: ['toybox'] },
  frisbee: { name: 'le frisbee', short: 'frisbee', category: 'toy', icon: '🥏', size: 0.13, carry: TOY, homes: ['toybox'] },
  croissants: { name: 'le sachet de croissants', short: 'croissants', category: 'food', icon: '🥐', size: 0.2,
    carry: { dog: true, human: true, stack: 1, slow: 0.02 }, edible: true, homes: ['counter', 'garden_table', 'bakery'] },
  baguette: { name: 'la baguette', short: 'baguette', category: 'food', icon: '🥖', size: 0.35,
    carry: { dog: true, human: true, stack: 1, slow: 0.03 }, edible: true, homes: ['bakery', 'counter', 'garden_table'], respawnAt: 'boulangerie' },
  toilet_roll: { name: 'le rouleau de papier toilette', short: 'papier toilette', category: 'roll', icon: '🧻', size: 0.12,
    carry: { dog: true, human: true, stack: 2, slow: 0.01 }, homes: ['roll_holder'], respawnAt: 'derouleur' },
  letter: { name: 'le courrier', short: 'courrier', category: 'paper', icon: '✉️', size: 0.15,
    carry: { dog: true, human: true, stack: 3, slow: 0 }, homes: ['mailbox', 'console'] },
  trash_bag: { name: 'le sac poubelle', short: 'sac poubelle', category: 'trash', icon: '🗑️', size: 0.3,
    carry: { dog: false, human: true, stack: 1, slow: 0.12 }, homes: ['street_bin'],
    rip: { verb: 'Déchirer le sac poubelle', text: 'Sac poubelle éventré !' } },
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
  // École.
  paint_pot: { name: 'le pot de peinture', short: 'pot de peinture', category: 'knockable', icon: '🎨', size: 0.12,
    knock: { mess: 'paint', chaos: 4, minSpeed: 0.8, push: 0, lie: 'side', height: 0.18, text: 'De la peinture partout !' } },
  book_pile: { name: 'la pile de livres', short: 'pile de livres', category: 'knockable', icon: '📚', size: 0.2,
    knock: { mess: 'books', chaos: 3, minSpeed: 0.8, push: 0, lie: 'scatter', height: 0.45, text: 'Les livres dégringolent !' } },
  // Centre commercial.
  mannequin: { name: 'le mannequin', short: 'mannequin', category: 'knockable', icon: '🧍', size: 0.25,
    knock: { mess: 'mannequin', chaos: 4, minSpeed: 2.5, push: 0.4, lie: 'side', height: 1.7, text: 'Le mannequin est tombé !' } },
  can_pyramid: { name: 'la pyramide de conserves', short: 'pyramide de conserves', category: 'knockable', icon: '🥫', size: 0.32,
    knock: { mess: 'cans', chaos: 5, minSpeed: 0.8, push: 0, lie: 'scatter', height: 0.9, text: 'Les conserves roulent partout !' } },
  cart: { name: 'le caddie', short: 'caddie', category: 'knockable', icon: '🛒', size: 0.38,
    knock: { mess: 'cart', chaos: 3, minSpeed: 3.0, push: 0.5, lie: 'side', height: 1.0, text: 'Caddie renversé !' } },
  // Parc.
  lemonade: { name: 'la carafe de citronnade', short: 'carafe', category: 'knockable', icon: '🍋', size: 0.1,
    knock: { mess: 'lemonade', chaos: 3, minSpeed: 0.6, push: 0, lie: 'side', height: 0.25, text: 'La citronnade ! Ça colle !' } },
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
  muddy_cushions: { name: 'des coussins boueux', dirt: 6, clean: 2.0, icon: '🛋️', verb: 'Brosser les coussins' },
  muddy_blanket: { name: 'une nappe boueuse', dirt: 6, clean: 2.0, icon: '🧺', verb: 'Secouer la nappe' },
  paint: { name: 'de la peinture renversée', dirt: 7, clean: 2.2, icon: '🎨', verb: 'Nettoyer la peinture', slippery: true },
  books: { name: 'des livres par terre', dirt: 5, clean: 1.8, icon: '📚', verb: 'Ranger les livres' },
  mannequin: { name: 'un mannequin renversé', dirt: 4, clean: 1.2, icon: '🧍', verb: 'Relever le mannequin' },
  cans: { name: 'des conserves par terre', dirt: 6, clean: 2.2, icon: '🥫', verb: 'Empiler les conserves', slippery: true },
  cart: { name: 'un caddie renversé', dirt: 3, clean: 1.0, icon: '🛒', verb: 'Relever le caddie' },
  lemonade: { name: 'de la citronnade renversée', dirt: 5, clean: 1.6, icon: '🍋', verb: 'Éponger la citronnade', slippery: true },
};
