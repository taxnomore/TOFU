import { MASK_HUMAN, MASK_ITEM, MASK_SOLID, PropDef, PropType } from './types';

export interface PropTypeDef {
  /** Footprint along local x. */
  w: number;
  /** Footprint along local z. */
  d: number;
  /** Visual height (used by the camera cutout and item landing). */
  h: number;
  col: 'box' | 'circle' | 'none';
  r?: number;
  mask: number;
  /** Footprint shrink for the collider (rounded furniture edges feel better). */
  inset?: number;
  /** Tall object rendered with the see-through occluder material. */
  tall?: boolean;
}

const HUMAN_ONLY = MASK_HUMAN | MASK_ITEM;

export const PROP_TYPES: Record<PropType, PropTypeDef> = {
  bed_double: { w: 1.8, d: 2.1, h: 0.55, col: 'box', mask: MASK_SOLID, inset: 0.03 },
  bed_single: { w: 1.0, d: 2.0, h: 0.5, col: 'box', mask: MASK_SOLID, inset: 0.03 },
  nightstand: { w: 0.45, d: 0.4, h: 0.55, col: 'box', mask: MASK_SOLID },
  wardrobe: { w: 1.6, d: 0.6, h: 2.0, col: 'box', mask: MASK_SOLID, tall: true },
  dresser: { w: 1.2, d: 0.5, h: 0.9, col: 'box', mask: MASK_SOLID },
  desk: { w: 1.1, d: 0.6, h: 0.75, col: 'box', mask: HUMAN_ONLY },
  bookshelf: { w: 1.2, d: 0.35, h: 1.8, col: 'box', mask: MASK_SOLID, tall: true },
  bookshelf_low: { w: 1.2, d: 0.35, h: 0.9, col: 'box', mask: MASK_SOLID },
  console: { w: 1.0, d: 0.35, h: 0.85, col: 'box', mask: MASK_SOLID },
  coat_rack: { w: 0.44, d: 0.44, h: 1.8, col: 'circle', r: 0.2, mask: MASK_SOLID },
  shoe_rack: { w: 0.8, d: 0.35, h: 0.5, col: 'box', mask: MASK_SOLID },
  counter: { w: 2.0, d: 0.6, h: 0.92, col: 'box', mask: MASK_SOLID },
  fridge: { w: 0.75, d: 0.7, h: 1.85, col: 'box', mask: MASK_SOLID, tall: true },
  round_table: { w: 1.1, d: 1.1, h: 0.75, col: 'circle', r: 0.5, mask: HUMAN_ONLY },
  chair: { w: 0.45, d: 0.45, h: 0.9, col: 'box', mask: MASK_HUMAN, inset: 0.05 },
  dining_table: { w: 1.9, d: 1.0, h: 0.76, col: 'box', mask: HUMAN_ONLY },
  sofa: { w: 2.2, d: 0.95, h: 0.85, col: 'box', mask: MASK_SOLID, inset: 0.04 },
  armchair: { w: 0.95, d: 0.9, h: 0.85, col: 'box', mask: MASK_SOLID, inset: 0.04 },
  coffee_table: { w: 1.1, d: 0.6, h: 0.42, col: 'box', mask: MASK_SOLID },
  tv_stand: { w: 1.6, d: 0.45, h: 0.5, col: 'box', mask: MASK_SOLID },
  washing_machine: { w: 0.6, d: 0.6, h: 0.85, col: 'box', mask: MASK_SOLID },
  bathtub: { w: 0.75, d: 1.7, h: 0.55, col: 'box', mask: MASK_SOLID },
  toilet: { w: 0.4, d: 0.65, h: 0.75, col: 'box', mask: MASK_SOLID },
  vanity: { w: 0.8, d: 0.5, h: 0.85, col: 'box', mask: MASK_SOLID },
  rug: { w: 2, d: 1.5, h: 0.01, col: 'none', mask: 0 },
  rug_round: { w: 2, d: 2, h: 0.01, col: 'none', mask: 0 },
  floor_lamp: { w: 0.3, d: 0.3, h: 1.6, col: 'circle', r: 0.15, mask: MASK_SOLID },
  wall_shelf: { w: 1.0, d: 0.25, h: 0.05, col: 'none', mask: 0 },
  picture: { w: 0.8, d: 0.04, h: 0.6, col: 'none', mask: 0 },
  garden_table: { w: 1.2, d: 1.2, h: 0.74, col: 'circle', r: 0.55, mask: HUMAN_ONLY },
  garden_chair: { w: 0.5, d: 0.5, h: 0.85, col: 'box', mask: MASK_HUMAN, inset: 0.05 },
  parasol: { w: 2.4, d: 2.4, h: 2.4, col: 'none', mask: 0 },
  clothes_post: { w: 0.16, d: 0.16, h: 1.9, col: 'circle', r: 0.09, mask: MASK_SOLID },
  shed: { w: 3.0, d: 3.0, h: 2.5, col: 'box', mask: MASK_SOLID, tall: true },
  sandbox: { w: 2.0, d: 2.0, h: 0.25, col: 'none', mask: 0 },
  slide: { w: 0.7, d: 2.4, h: 1.5, col: 'box', mask: MASK_SOLID },
  tree: { w: 3, d: 3, h: 5, col: 'circle', r: 0.3, mask: MASK_SOLID, tall: true },
  fruit_tree: { w: 2.6, d: 2.6, h: 3.6, col: 'circle', r: 0.22, mask: MASK_SOLID, tall: true },
  bush: { w: 1.2, d: 1.2, h: 1.0, col: 'circle', r: 0.5, mask: MASK_SOLID },
  car: { w: 1.8, d: 4.0, h: 1.5, col: 'box', mask: MASK_SOLID, inset: 0.05, tall: true },
  streetlamp: { w: 0.3, d: 0.3, h: 4.2, col: 'circle', r: 0.12, mask: MASK_SOLID, tall: true },
  plane_tree: { w: 4, d: 4, h: 7, col: 'circle', r: 0.35, mask: MASK_SOLID, tall: true },
  bench: { w: 1.6, d: 0.6, h: 0.85, col: 'box', mask: MASK_SOLID },
  bollard: { w: 0.24, d: 0.24, h: 0.8, col: 'circle', r: 0.12, mask: MASK_SOLID },
  barrier: { w: 2.0, d: 0.3, h: 1.0, col: 'box', mask: MASK_SOLID },
  spring_rider: { w: 0.6, d: 0.9, h: 0.9, col: 'circle', r: 0.3, mask: MASK_SOLID },
  planter: { w: 1.2, d: 0.5, h: 0.6, col: 'box', mask: MASK_SOLID },
  veg_patch: { w: 4, d: 3, h: 0.3, col: 'none', mask: 0 },
  flowerbed: { w: 1.2, d: 4, h: 0.25, col: 'none', mask: 0 },
  bike: { w: 0.5, d: 1.7, h: 1.0, col: 'box', mask: MASK_SOLID },
  roadsign: { w: 0.5, d: 0.1, h: 2.4, col: 'circle', r: 0.06, mask: MASK_SOLID },
  cafe_table: { w: 0.7, d: 0.7, h: 0.75, col: 'circle', r: 0.33, mask: HUMAN_ONLY },
  awning: { w: 6, d: 1.6, h: 2.6, col: 'none', mask: 0 },
  mailbox_post: { w: 0.4, d: 0.3, h: 1.2, col: 'circle', r: 0.15, mask: MASK_SOLID },
  dog_bowl: { w: 0.3, d: 0.3, h: 0.08, col: 'none', mask: 0 },
  pot_decor: { w: 0.5, d: 0.5, h: 0.6, col: 'circle', r: 0.24, mask: MASK_SOLID },
  swing_set: { w: 2.6, d: 1.4, h: 2.1, col: 'none', mask: 0, tall: true },
  hydrant: { w: 0.3, d: 0.3, h: 0.8, col: 'circle', r: 0.15, mask: MASK_SOLID },
  bus_shelter: { w: 3, d: 1.4, h: 2.4, col: 'box', mask: MASK_SOLID, tall: true },
  kennel: { w: 1.0, d: 1.2, h: 1.1, col: 'box', mask: MASK_SOLID },
  toybox: { w: 0.9, d: 0.5, h: 0.5, col: 'box', mask: MASK_SOLID },
  hamper: { w: 0.56, d: 0.56, h: 0.6, col: 'circle', r: 0.27, mask: MASK_SOLID },
  dog_basket: { w: 1.1, d: 1.1, h: 0.25, col: 'none', mask: 0 },
  bakery_stand: { w: 2.4, d: 0.7, h: 0.95, col: 'box', mask: MASK_SOLID },
  clothesline_basket: { w: 0.6, d: 0.45, h: 0.35, col: 'none', mask: 0 },
};

/** Returns the world-space footprint half extents of a prop considering its rotation. */
export function propExtents(p: PropDef): { hw: number; hd: number; w: number; d: number; h: number } {
  const t = PROP_TYPES[p.type];
  const w = p.w ?? t.w;
  const d = p.d ?? t.d;
  const h = p.h ?? t.h;
  const rot = ((p.rot ?? 0) % 4 + 4) % 4;
  const swap = rot === 1 || rot === 3;
  return { hw: (swap ? d : w) / 2, hd: (swap ? w : d) / 2, w, d, h };
}
