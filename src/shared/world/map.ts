// The whole playable world as data: house interior, garden, neighborhood.
//
// Coordinates are meters. x grows east, z grows south, y is up.
// The street runs east-west at z in [-23,-16]. The family house sits at
// x in [-14,6], z in [-6,6] with its front door facing the street (north)
// and its garden behind it (south).
//
//      N (z-)   buildings + boulangerie             <- z = -27
//               trottoir nord
//               ===== rue des Tilleuls =====
//               trottoir sud                        <- z = -13
//   square  |  devant  | allée | chez les voisins
//   (west)  |  MAISON  | (car) |
//           |  jardin  |       |
//      S (z+)                                       <- z = 22

import type {
  BuildingDef, CatEdge, CatNode, DoorDef, FloorPatch, ItemPlacement, PropDef, Puddle, Spawn, StationDef,
  WallDef, Zone,
} from './types';

export const WORLD_BOUNDS = { x0: -30.5, z0: -27.5, x1: 32.5, z1: 22.5 };

export const WALL_HEIGHT = 2.7;

export const ZONES: Zone[] = [
  { id: 'chambre', name: 'la chambre', label: 'Chambre', indoor: true, x0: -14, z0: -6, x1: -8, z1: 0, floor: 'parquet', wallColor: 0xc5d6b0 },
  { id: 'enfants', name: 'la chambre des enfants', label: 'Chambre des enfants', indoor: true, x0: -14, z0: 0, x1: -8, z1: 6, floor: 'carpet', wallColor: 0xf7d9a8 },
  { id: 'entree', name: "l'entrée", label: 'Entrée', indoor: true, x0: -8, z0: -6, x1: -5, z1: 6, floor: 'cement_tiles', wallColor: 0xf1e6cf },
  { id: 'cuisine', name: 'la cuisine', label: 'Cuisine', indoor: true, x0: -5, z0: -6, x1: 1.5, z1: 0, floor: 'tomettes', wallColor: 0xd2e6ee },
  { id: 'buanderie', name: 'la buanderie', label: 'Salle de bain', indoor: true, x0: 1.5, z0: -6, x1: 6, z1: 0, floor: 'white_tiles', wallColor: 0xbde4dd },
  { id: 'salon', name: 'le salon', label: 'Salon', indoor: true, x0: -5, z0: 0, x1: 6, z1: 6, floor: 'parquet_light', wallColor: 0xf5e2cc },
  { id: 'terrasse', name: 'la terrasse', label: 'Terrasse', indoor: false, x0: -5, z0: 6, x1: 6, z1: 9.5 },
  { id: 'jardin', name: 'le jardin', label: 'Jardin', indoor: false, x0: -14, z0: 6, x1: 10.5, z1: 22 },
  { id: 'allee', name: "l'allée", label: 'Allée', indoor: false, x0: 6, z0: -13, x1: 10.5, z1: 6 },
  { id: 'devant', name: 'le devant de la maison', label: 'Devant la maison', indoor: false, x0: -14, z0: -13, x1: 6, z1: -6 },
  { id: 'square', name: 'le square', label: 'Square', indoor: false, x0: -28.5, z0: -13, x1: -14, z1: 22.5 },
  { id: 'voisins', name: 'chez les voisins', label: 'Chez les voisins', indoor: false, x0: 10.5, z0: -13, x1: 32.5, z1: -5 },
  { id: 'boulangerie', name: 'devant la boulangerie', label: 'Boulangerie', indoor: false, x0: -8.5, z0: -27.5, x1: 6.5, z1: -23 },
  { id: 'trottoir_s', name: 'le trottoir', label: 'Trottoir', indoor: false, x0: -30.5, z0: -16, x1: 32.5, z1: -13 },
  { id: 'trottoir_n', name: 'le trottoir', label: 'Trottoir', indoor: false, x0: -30.5, z0: -27.5, x1: 32.5, z1: -23 },
  { id: 'rue', name: 'la rue', label: 'Rue des Tilleuls', indoor: false, x0: -30.5, z0: -23, x1: 32.5, z1: -16 },
];

/** Zones that count as "the street" for mischief objectives. */
export const STREET_ZONES = ['rue', 'trottoir_s', 'trottoir_n', 'boulangerie'];
/** Zones outside the family property. */
export const OUTSIDE_PROPERTY_ZONES = ['rue', 'trottoir_s', 'trottoir_n', 'boulangerie', 'square', 'voisins'];

export const FLOORS: FloorPatch[] = [
  // Interior floors.
  { kind: 'parquet', x0: -14, z0: -6, x1: -8, z1: 0 },
  { kind: 'carpet', x0: -14, z0: 0, x1: -8, z1: 6 },
  { kind: 'cement_tiles', x0: -8, z0: -6, x1: -5, z1: 6 },
  { kind: 'tomettes', x0: -5, z0: -6, x1: 1.5, z1: 0 },
  { kind: 'white_tiles', x0: 1.5, z0: -6, x1: 6, z1: 0 },
  { kind: 'parquet_light', x0: -5, z0: 0, x1: 6, z1: 6, rot: 1 },
  // Garden and yards.
  { kind: 'terrace', x0: -5.5, z0: 6, x1: 6.0, z1: 9.6 },
  { kind: 'pavers', x0: -7.4, z0: 6, x1: -5.5, z1: 7.6 },
  { kind: 'gravel', x0: 6, z0: -13, x1: 10.5, z1: 6 },
  { kind: 'pavers', x0: -7.2, z0: -9.4, x1: -5.8, z1: -6 },
  { kind: 'pavers', x0: -7.2, z0: -9.4, x1: 6, z1: -8.0 },
  { kind: 'soil', x0: 8.7, z0: 8.8, x1: 10.2, z1: 14.2 },
  { kind: 'soil', x0: -6.6, z0: 20.4, x1: -0.4, z1: 21.6 },
  { kind: 'sand', x0: -12.0, z0: 18.6, x1: -10.0, z1: 20.6 },
  // Street.
  { kind: 'asphalt', x0: -30.5, z0: -23, x1: 32.5, z1: -16 },
  { kind: 'sidewalk', x0: -30.5, z0: -16, x1: 32.5, z1: -13 },
  { kind: 'sidewalk', x0: -30.5, z0: -27.5, x1: 32.5, z1: -23 },
  { kind: 'crosswalk', x0: -7.6, z0: -22.8, x1: -4.4, z1: -16.2, y: 0.004 },
  // Square.
  { kind: 'gravel', x0: -24.5, z0: -13, x1: -18.5, z1: -9.5 },
  { kind: 'sand', x0: -26.5, z0: -9, x1: -19.5, z1: -4 },
  { kind: 'gravel', x0: -22.2, z0: -9.5, x1: -18.8, z1: 19 },
  { kind: 'gravel', x0: -26, z0: 1.5, x1: -15.5, z1: 10 },
  { kind: 'gravel', x0: -18.8, z0: 13.5, x1: -14.0, z1: 16.6 },
  // Neighbors.
  { kind: 'pavers', x0: 13, z0: -13, x1: 17, z1: -5 },
  { kind: 'pavers', x0: 19.4, z0: -13, x1: 20.6, z1: -5 },
];

const EXT_SHUTTER = 0x5d86a6;

export const WALLS: WallDef[] = [
  // --- House exterior ---
  { id: 'w_front', x0: -14, z0: -6, x1: 6, z1: -6, style: 'house_ext', shutter: EXT_SHUTTER, openings: [
    { at: 3, width: 1.4, kind: 'window', sill: 0.9, top: 2.1 },
    { at: 7.5, width: 1.2, kind: 'door', door: 'porte_entree' },
    { at: 12, width: 1.2, kind: 'window', sill: 1.05, top: 2.05, open: true },
    { at: 17.8, width: 0.8, kind: 'window', sill: 1.3, top: 2.0 },
  ] },
  { id: 'w_back', x0: -14, z0: 6, x1: 6, z1: 6, style: 'house_ext', shutter: EXT_SHUTTER, openings: [
    { at: 3, width: 1.4, kind: 'window', sill: 0.9, top: 2.1 },
    { at: 7.5, width: 1.2, kind: 'door', door: 'porte_arriere' },
    { at: 14.75, width: 3.5, kind: 'door', door: 'baie' },
    { at: 18.6, width: 1.2, kind: 'window', sill: 0.9, top: 2.1 },
  ] },
  { id: 'w_west', x0: -14, z0: -6, x1: -14, z1: 6, style: 'house_ext', shutter: EXT_SHUTTER, openings: [
    { at: 3, width: 1.2, kind: 'window', sill: 0.9, top: 2.1 },
    { at: 9, width: 1.2, kind: 'window', sill: 0.9, top: 2.1 },
  ] },
  { id: 'w_east', x0: 6, z0: -6, x1: 6, z1: 6, style: 'house_ext', shutter: EXT_SHUTTER, openings: [
    { at: 3, width: 0.8, kind: 'window', sill: 1.3, top: 2.0 },
    { at: 10.6, width: 1.2, kind: 'window', sill: 0.9, top: 2.1 },
  ] },
  // --- House interior walls ---
  { id: 'i_hall_w', x0: -8, z0: -6, x1: -8, z1: 6, style: 'house_int', openings: [
    { at: 3, width: 1.1, kind: 'door', door: 'porte_chambre' },
    { at: 9, width: 1.1, kind: 'door', door: 'porte_enfants' },
  ] },
  { id: 'i_bed_kids', x0: -14, z0: 0, x1: -8, z1: 0, style: 'house_int' },
  { id: 'i_hall_e', x0: -5, z0: -6, x1: -5, z1: 6, style: 'house_int', openings: [
    { at: 3, width: 1.1, kind: 'door', door: 'porte_cuisine' },
    { at: 9, width: 1.1, kind: 'door', door: 'porte_salon' },
  ] },
  { id: 'i_kit_liv', x0: -5, z0: 0, x1: 1.5, z1: 0, style: 'house_int', openings: [
    { at: 3.5, width: 2.2, kind: 'arch' },
  ] },
  { id: 'i_kit_bath', x0: 1.5, z0: -6, x1: 1.5, z1: 0, style: 'house_int' },
  { id: 'i_bath_liv', x0: 1.5, z0: 0, x1: 6, z1: 0, style: 'house_int', openings: [
    { at: 2.3, width: 1.0, kind: 'door', door: 'porte_sdb' },
  ] },
  // --- Family property boundaries ---
  { id: 'f_front', x0: -14, z0: -13, x1: 10.5, z1: -13, style: 'low_wall', openings: [
    { at: 22.25, width: 3.2, kind: 'gate', door: 'portail' },
  ] },
  { id: 'f_front_west', x0: -14, z0: -13, x1: -14, z1: -6, style: 'hedge' },
  { id: 'f_garden_west', x0: -14, z0: 6, x1: -14, z1: 22, style: 'hedge', openings: [
    { at: 9.1, width: 1.1, kind: 'doghole' },
  ] },
  { id: 'f_garden_south', x0: -14, z0: 22, x1: 10.5, z1: 22, style: 'hedge' },
  { id: 'f_east', x0: 10.5, z0: -13, x1: 10.5, z1: 22, style: 'stone' },
  { id: 'f_alley_garden', x0: 6, z0: 6, x1: 10.5, z1: 6, style: 'garden_fence', openings: [
    { at: 2.25, width: 2.6, kind: 'gate', door: 'portillon' },
  ] },
  // --- Square ---
  { id: 's_front', x0: -28.5, z0: -13, x1: -14, z1: -13, style: 'low_wall', openings: [
    { at: 7, width: 6, kind: 'arch' },
  ] },
  { id: 's_west', x0: -28.5, z0: -13, x1: -28.5, z1: 22.5, style: 'stone', height: 2.2 },
  { id: 's_south', x0: -28.5, z0: 22.5, x1: -14, z1: 22.5, style: 'hedge' },
  // --- Neighbors ---
  { id: 'n_front', x0: 10.5, z0: -13, x1: 32.5, z1: -13, style: 'low_wall', openings: [
    { at: 4.5, width: 4, kind: 'arch' },
    { at: 9.5, width: 1.2, kind: 'arch' },
  ] },
  { id: 'n_fence_w', x0: 10.5, z0: -5, x1: 12, z1: -5, style: 'garden_fence' },
  { id: 'n_fence_e', x0: 28, z0: -5, x1: 32.5, z1: -5, style: 'garden_fence' },
  { id: 'n_east', x0: 32.5, z0: -13, x1: 32.5, z1: -5, style: 'hedge' },
  // --- Street ends (natural boundaries) ---
  { id: 'e_west', x0: -30.8, z0: -27.5, x1: -30.8, z1: -13, style: 'hedge', height: 2.4 },
  { id: 'e_east', x0: 32.8, z0: -27.5, x1: 32.8, z1: -13, style: 'hedge', height: 2.4 },
];

export const BUILDINGS: BuildingDef[] = [
  { id: 'b_voisins', x0: 12, z0: -5, x1: 28, z1: 7, front: 'n', storeys: 2, color: 0xf0dbbd, shutter: 0x6f9a6b, door: 0x8b5a3c, doorX: 20 },
  { id: 'b_n1', x0: -31, z0: -36, x1: -19.4, z1: -27.5, front: 's', storeys: 2, color: 0xe7d6c2, shutter: 0x7ea2c8, door: 0x40566b, doorX: -25 },
  { id: 'b_n2', x0: -19.4, z0: -36, x1: -8.5, z1: -27.5, front: 's', storeys: 2, color: 0xdcb596, shutter: 0xf0ebe0, door: 0x6c3b2a, doorX: -12 },
  { id: 'b_bakery', x0: -8.5, z0: -36, x1: 6.5, z1: -27.5, front: 's', storeys: 2, color: 0xf4ebd6, shutter: 0xb84a3a, door: 0x7a2d24, doorX: 3.5, shop: 'bakery' },
  { id: 'b_n3', x0: 6.5, z0: -36, x1: 19.5, z1: -27.5, front: 's', storeys: 2, color: 0xefc8a2, shutter: 0x4f7ea3, door: 0x2f4f6f, doorX: 13 },
  { id: 'b_n4', x0: 19.5, z0: -36, x1: 33, z1: -27.5, front: 's', storeys: 2, color: 0xe3e0d3, shutter: 0xb06447, door: 0x5b3a2a, doorX: 26 },
];

export const DOORS: DoorDef[] = [
  { id: 'porte_entree', name: "la porte d'entrée", kind: 'exterior', x: -6.5, z: -6, axis: 'x', width: 1.2, hinge: -1, swing: 1, dogCanPush: false, dogFlap: false, open: false, color: 0x3f7cac },
  { id: 'porte_arriere', name: 'la porte du jardin', kind: 'exterior', x: -6.5, z: 6, axis: 'x', width: 1.2, hinge: -1, swing: -1, dogCanPush: false, dogFlap: true, open: false, color: 0x5f9460 },
  { id: 'baie', name: 'la baie vitrée', kind: 'bay', x: 0.75, z: 6, axis: 'x', width: 3.5, hinge: 1, swing: 1, dogCanPush: false, dogFlap: false, open: true },
  { id: 'porte_chambre', name: 'la porte de la chambre', kind: 'interior', x: -8, z: -3, axis: 'z', width: 1.1, hinge: -1, swing: -1, dogCanPush: true, dogFlap: false, open: true, color: 0xf4efe4 },
  { id: 'porte_enfants', name: 'la porte de la chambre des enfants', kind: 'interior', x: -8, z: 3, axis: 'z', width: 1.1, hinge: 1, swing: -1, dogCanPush: true, dogFlap: false, open: true, color: 0xf4efe4 },
  { id: 'porte_cuisine', name: 'la porte de la cuisine', kind: 'interior', x: -5, z: -3, axis: 'z', width: 1.1, hinge: -1, swing: 1, dogCanPush: true, dogFlap: false, open: true, color: 0xf4efe4 },
  { id: 'porte_salon', name: 'la porte du salon', kind: 'interior', x: -5, z: 3, axis: 'z', width: 1.1, hinge: 1, swing: 1, dogCanPush: true, dogFlap: false, open: true, color: 0xf4efe4 },
  { id: 'porte_sdb', name: 'la porte de la salle de bain', kind: 'interior', x: 3.8, z: 0, axis: 'x', width: 1.0, hinge: 1, swing: -1, dogCanPush: true, dogFlap: false, open: true, color: 0xf4efe4 },
  { id: 'portail', name: 'le portail', kind: 'gate', x: 8.25, z: -13, axis: 'x', width: 3.2, hinge: -1, swing: 1, dogCanPush: false, dogFlap: false, open: true, color: 0x2f5d50 },
  { id: 'portillon', name: 'le portillon du jardin', kind: 'gate', x: 8.25, z: 6, axis: 'x', width: 2.6, hinge: -1, swing: 1, dogCanPush: false, dogFlap: false, open: false, color: 0x9a7b54 },
];

export const PROPS: PropDef[] = [
  // --- Chambre ---
  { type: 'bed_double', x: -12.8, z: -3.0, rot: 1, color: 0xf6f1e7, color2: 0x8e6e53 },
  { type: 'nightstand', x: -13.6, z: -4.25, rot: 1 },
  { type: 'nightstand', x: -13.6, z: -1.75, rot: 1 },
  { type: 'wardrobe', x: -10.2, z: -5.5, rot: 0 },
  { type: 'dresser', x: -10.6, z: -0.4, rot: 2 },
  { type: 'rug', x: -10.7, z: -3.0, w: 1.7, d: 2.4, rot: 1, color: 0xc98b7a },
  { type: 'picture', x: -10.2, z: -0.1, rot: 2, color: 0x7aa6c2 },
  // --- Chambre des enfants ---
  { type: 'bed_single', x: -12.85, z: 5.3, rot: 1, color: 0x9fd3f0, color2: 0xf2c14e },
  { type: 'toybox', x: -8.5, z: 4.6, rot: 3 },
  { type: 'desk', x: -13.5, z: 1.3, rot: 1 },
  { type: 'chair', x: -12.85, z: 1.3, rot: 3, color: 0xe9784f },
  { type: 'bookshelf', x: -10.8, z: 0.25, rot: 0, color: 0xf2f2ee },
  { type: 'rug_round', x: -11.0, z: 3.0, w: 2.4, d: 2.4, color: 0x7cc4a8 },
  { type: 'picture', x: -13.9, z: 3.6, rot: 1, color: 0xf2a65a },
  // --- Entrée ---
  { type: 'console', x: -5.3, z: 0, rot: 3 },
  { type: 'coat_rack', x: -7.55, z: -5.45 },
  { type: 'shoe_rack', x: -7.75, z: -4.6, rot: 1 },
  { type: 'rug', x: -6.5, z: 0, w: 1.1, d: 8.5, color: 0xb5524a },
  { type: 'picture', x: -7.95, z: 0.6, rot: 1, color: 0xd9a35b },
  // --- Cuisine ---
  { type: 'counter', x: -1.3, z: -5.55, w: 5.3, rot: 0 },
  { type: 'counter', x: 1.05, z: -4.05, w: 2.4, rot: 3 },
  { type: 'fridge', x: -4.5, z: -5.45, rot: 0 },
  { type: 'round_table', x: -2.0, z: -2.6 },
  { type: 'chair', x: -2.0, z: -1.75, rot: 2 },
  { type: 'chair', x: -2.0, z: -3.45, rot: 0 },
  { type: 'chair', x: -2.85, z: -2.6, rot: 1 },
  // --- Salle de bain / buanderie ---
  { type: 'washing_machine', x: 2.15, z: -5.45, rot: 0 },
  { type: 'hamper', x: 2.95, z: -5.45 },
  { type: 'bathtub', x: 5.45, z: -4.95, rot: 0 },
  { type: 'vanity', x: 1.85, z: -2.4, rot: 1 },
  { type: 'toilet', x: 5.5, z: -1.0, rot: 3 },
  { type: 'rug', x: 4.0, z: -3.2, w: 1.0, d: 0.7, color: 0x7fb7c9 },
  // --- Salon ---
  { type: 'dining_table', x: -2.6, z: 2.9, rot: 0 },
  { type: 'chair', x: -3.15, z: 2.05, rot: 0 },
  { type: 'chair', x: -2.05, z: 2.05, rot: 0 },
  { type: 'chair', x: -3.15, z: 3.75, rot: 2 },
  { type: 'chair', x: -2.05, z: 3.75, rot: 2 },
  { type: 'sofa', x: 2.0, z: 2.4, rot: 1, color: 0x5b7fa6 },
  { type: 'coffee_table', x: 3.55, z: 2.4, rot: 1 },
  { type: 'tv_stand', x: 5.6, z: 2.4, rot: 3 },
  { type: 'armchair', x: 4.0, z: 4.7, rot: 2, color: 0xd98a4e },
  { type: 'bookshelf', x: 0.4, z: 0.3, rot: 0 },
  { type: 'rug', x: 3.3, z: 2.4, w: 2.6, d: 2.2, rot: 1, color: 0xd9a35b },
  { type: 'floor_lamp', x: 5.55, z: 0.55 },
  { type: 'dog_basket', x: -4.25, z: 5.25 },
  { type: 'picture', x: -0.6, z: 5.85, rot: 2, color: 0x6fa58a },
  // --- Terrasse & jardin ---
  { type: 'garden_table', x: 2.6, z: 8.1 },
  { type: 'garden_chair', x: 2.6, z: 7.25, rot: 0 },
  { type: 'garden_chair', x: 2.6, z: 8.95, rot: 2 },
  { type: 'garden_chair', x: 1.75, z: 8.1, rot: 1 },
  { type: 'garden_chair', x: 3.45, z: 8.1, rot: 3 },
  { type: 'parasol', x: 2.6, z: 8.1 },
  { type: 'dog_bowl', x: -4.4, z: 6.6 },
  { type: 'kennel', x: -12.6, z: 7.5, rot: 0 },
  { type: 'clothes_post', x: -12.4, z: 13.5 },
  { type: 'clothes_post', x: -5.6, z: 13.5 },
  { type: 'clothesline_basket', x: -6.3, z: 14.4 },
  { type: 'fruit_tree', x: -1.5, z: 15.5 },
  { type: 'fruit_tree', x: -11.8, z: 10.6, v: 1 },
  { type: 'shed', x: 8.3, z: 20.0, rot: 3 },
  { type: 'veg_patch', x: 5.4, z: 16.2, w: 3.6, d: 2.8 },
  { type: 'flowerbed', x: 9.45, z: 11.5, w: 1.4, d: 5.2 },
  { type: 'flowerbed', x: -3.5, z: 21.0, w: 6.0, d: 1.1 },
  { type: 'sandbox', x: -11.0, z: 19.6 },
  { type: 'slide', x: -7.5, z: 19.6, rot: 0 },
  { type: 'bush', x: -13.0, z: 21.0 },
  { type: 'bush', x: 9.5, z: 17.0 },
  { type: 'bush', x: -0.2, z: 21.2, v: 1 },
  // --- Allée ---
  { type: 'car', x: 8.25, z: -8.5, rot: 0, color: 0xd2483a },
  { type: 'bike', x: 6.6, z: -2.0, rot: 0 },
  // --- Devant de la maison ---
  { type: 'bush', x: -12.8, z: -11.8 },
  { type: 'bush', x: -10.4, z: -12.0, v: 1 },
  { type: 'bush', x: -2.0, z: -12.1 },
  { type: 'bush', x: 1.5, z: -12.1, v: 1 },
  { type: 'fruit_tree', x: -11.0, z: -8.6, v: 2 },
  { type: 'pot_decor', x: -7.6, z: -6.6 },
  // --- Rue ---
  { type: 'plane_tree', x: -22, z: -15.0 },
  { type: 'plane_tree', x: -9, z: -15.0 },
  { type: 'plane_tree', x: 0.0, z: -15.2 },
  { type: 'plane_tree', x: 24, z: -15.0 },
  { type: 'plane_tree', x: -24, z: -25.0 },
  { type: 'plane_tree', x: -12, z: -25.0 },
  { type: 'plane_tree', x: 10, z: -25.0 },
  { type: 'plane_tree', x: 26, z: -25.0 },
  { type: 'streetlamp', x: -16, z: -13.5 },
  { type: 'streetlamp', x: 12.4, z: -13.5 },
  { type: 'streetlamp', x: -18, z: -26.5 },
  { type: 'streetlamp', x: 16, z: -26.5 },
  { type: 'car', x: -17, z: -21.9, rot: 1, color: 0x6aa5c9, v: 1 },
  { type: 'car', x: 21, z: -21.9, rot: 3, color: 0xf2c94c, v: 2 },
  { type: 'car', x: -25, z: -17.1, rot: 1, color: 0x8fbf6a, v: 0 },
  { type: 'hydrant', x: 11.5, z: -13.6 },
  { type: 'roadsign', x: -13.6, z: -13.5 },
  { type: 'cafe_table', x: 3.8, z: -25.0 },
  { type: 'garden_chair', x: 3.0, z: -25.0, rot: 1, color: 0x2e6b5e },
  { type: 'garden_chair', x: 4.6, z: -25.0, rot: 3, color: 0x2e6b5e },
  { type: 'bakery_stand', x: -2.0, z: -26.75, rot: 0 },
  { type: 'awning', x: -1.0, z: -26.7, w: 13, d: 1.8 },
  { type: 'barrier', x: -29.6, z: -26.0, rot: 1, v: 1 },
  { type: 'barrier', x: -29.6, z: -23.5, rot: 1 },
  { type: 'barrier', x: -29.6, z: -21.0, rot: 1 },
  { type: 'barrier', x: -29.6, z: -18.5, rot: 1 },
  { type: 'barrier', x: -29.6, z: -16.0, rot: 1 },
  { type: 'barrier', x: -29.6, z: -14.0, rot: 1, v: 1 },
  { type: 'bollard', x: 31.8, z: -22.0 },
  { type: 'bollard', x: 31.8, z: -19.5 },
  { type: 'bollard', x: 31.8, z: -17.0 },
  // --- Square ---
  { type: 'bench', x: -16.0, z: 2.0, rot: 3 },
  { type: 'bench', x: -26.0, z: 6.0, rot: 1 },
  { type: 'tree', x: -21.0, z: 6.0 },
  { type: 'tree', x: -25.0, z: 16.0, v: 1 },
  { type: 'tree', x: -16.4, z: -7.0, v: 2 },
  { type: 'streetlamp', x: -19.0, z: -1.0 },
  { type: 'spring_rider', x: -22.0, z: 13.0 },
  { type: 'spring_rider', x: -24.0, z: 11.6, v: 1 },
  { type: 'planter', x: -27.6, z: -2.0, rot: 1 },
  { type: 'planter', x: -27.6, z: 10.0, rot: 1 },
  { type: 'bush', x: -15.2, z: 19.6 },
  { type: 'bush', x: -26.8, z: 20.6, v: 1 },
  { type: 'bush', x: -15.2, z: -11.4 },
  { type: 'bush', x: -27.2, z: -11.4, v: 1 },
  // --- Chez les voisins ---
  { type: 'car', x: 15.0, z: -9.0, rot: 0, color: 0x3d6fa8, v: 1 },
  { type: 'fruit_tree', x: 26.5, z: -9.5, v: 2 },
  { type: 'bush', x: 30.8, z: -11.6 },
  { type: 'bush', x: 30.8, z: -6.6, v: 1 },
  { type: 'bush', x: 11.4, z: -6.0, v: 1 },
  { type: 'mailbox_post', x: 12.0, z: -12.4 },
];

/** Interaction stations. */
export const STATIONS: StationDef[] = [
  { id: 'panier_linge', kind: 'hamper', name: 'le panier à linge', x: 2.95, z: -5.45, y: 0.62, r: 1.0, dogReach: false, capacity: 12 },
  { id: 'commode', kind: 'dresser', name: 'la commode', x: -10.6, z: -0.4, y: 0.9, r: 0.9, hw: 0.6, hd: 0.25, dogReach: true, capacity: 12 },
  { id: 'fil_linge', kind: 'clothesline', name: 'le fil à linge', x: -9.0, z: 13.5, y: 1.45, r: 1.0, hw: 3.0, hd: 0.1, dogReach: true, capacity: 4,
    slots: [[-2.4, 1.45, 0], [-0.8, 1.45, 0], [0.8, 1.45, 0], [2.4, 1.45, 0]] },
  { id: 'coffre_jouets', kind: 'toybox', name: 'le coffre à jouets', x: -8.5, z: 4.6, y: 0.5, r: 0.85, hw: 0.25, hd: 0.45, dogReach: true, capacity: 8 },
  { id: 'table_salon', kind: 'dining_table', name: 'la table du salon', x: -2.6, z: 2.9, y: 0.76, r: 0.9, hw: 0.95, hd: 0.5, dogReach: false, capacity: 1 },
  { id: 'table_jardin', kind: 'garden_table', name: 'la table du jardin', x: 2.6, z: 8.1, y: 0.74, r: 1.0, hw: 0.4, hd: 0.4, dogReach: true, capacity: 2 },
  { id: 'console', kind: 'console', name: "la console de l'entrée", x: -5.3, z: 0, y: 0.85, r: 0.85, hw: 0.17, hd: 0.5, dogReach: true, capacity: 3 },
  { id: 'poubelle_rue', kind: 'street_bin', name: 'la poubelle de la rue', x: 4.8, z: -14.0, y: 1.0, r: 1.5, dogReach: false, linkedItem: 'bin_rue', capacity: 2 },
  { id: 'boite_lettres', kind: 'mailbox', name: 'la boîte aux lettres', x: 6.0, z: -13.0, y: 1.0, r: 1.25, dogReach: false, capacity: 3 },
  { id: 'placard', kind: 'cupboard', name: 'le placard à vaisselle', x: -0.9, z: -5.55, y: 0.92, r: 0.95, hw: 0.4, hd: 0.3, dogReach: false, capacity: 1 },
  { id: 'plan_travail', kind: 'counter', name: 'le plan de travail', x: -3.3, z: -5.55, y: 0.92, r: 0.95, hw: 0.4, hd: 0.3, dogReach: true, capacity: 2 },
  { id: 'bocal', kind: 'treat_jar', name: 'le bocal de friandises', x: 0.4, z: -5.55, y: 0.92, r: 0.95, hw: 0.3, hd: 0.3 },
  { id: 'boulangerie', kind: 'bakery', name: 'la boulangerie', x: -2.0, z: -26.75, y: 0.95, r: 1.0, hw: 1.2, hd: 0.35, dogReach: true, capacity: 3,
    slots: [[-0.7, 0.95, 0], [0.0, 0.95, 0], [0.7, 0.95, 0]] },
  { id: 'lit', kind: 'bed', name: 'le lit', x: -12.8, z: -3.0, y: 0.55, r: 0.75, hw: 1.05, hd: 0.9 },
  { id: 'canape', kind: 'sofa', name: 'le canapé', x: 2.0, z: 2.4, y: 0.45, r: 0.75, hw: 0.47, hd: 1.1 },
  { id: 'massif_est', kind: 'flowerbed', name: 'le massif de fleurs', x: 9.45, z: 11.5, y: 0.2, r: 0.9, hw: 0.7, hd: 2.6 },
  { id: 'massif_sud', kind: 'flowerbed', name: 'le massif du fond', x: -3.5, z: 21.0, y: 0.2, r: 0.9, hw: 3.0, hd: 0.55 },
  { id: 'panier_tofu', kind: 'dog_basket', name: 'le panier de Tofu', x: -4.25, z: 5.25, y: 0.12, r: 0.95, capacity: 20,
    slots: [[-0.2, 0.15, -0.1], [0.2, 0.15, 0.1], [0.0, 0.18, 0.25], [-0.25, 0.2, 0.25], [0.25, 0.2, -0.2]] },
  { id: 'niche', kind: 'dog_basket', name: 'la niche', x: -12.6, z: 8.45, y: 0.05, r: 0.95, capacity: 20,
    slots: [[-0.25, 0.05, 0], [0.25, 0.05, 0], [0, 0.08, 0.2], [-0.2, 0.1, 0.3], [0.2, 0.1, 0.3]] },
  { id: 'robinet', kind: 'tap', name: 'le robinet', x: 5.6, z: 6.4, y: 0.8, r: 1.0 },
  { id: 'meuble_chaussures', kind: 'shoe_rack', name: 'le meuble à chaussures', x: -7.75, z: -4.6, y: 0.5, r: 0.85, hw: 0.17, hd: 0.4, dogReach: true, capacity: 4 },
  { id: 'pied_lit', kind: 'bedside', name: 'le pied du lit', x: -11.3, z: -3.0, y: 0.0, r: 0.9, dogReach: true, capacity: 4,
    slots: [[0.1, 0.0, -0.25], [0.1, 0.0, 0.25], [0.35, 0, 0], [-0.1, 0, 0.5]] },
];

export const ITEMS: ItemPlacement[] = [
  // Laundry
  { id: 'chaussette_1', type: 'sock', station: 'panier_linge' },
  { id: 'chaussette_2', type: 'sock2', station: 'panier_linge' },
  { id: 'chaussette_3', type: 'sock', station: 'commode' },
  { id: 'slip_1', type: 'underwear', station: 'commode' },
  { id: 'chausson_1', type: 'slipper', station: 'pied_lit' },
  { id: 'chausson_2', type: 'slipper', station: 'pied_lit' },
  { id: 'linge_1', type: 'tshirt', station: 'fil_linge' },
  { id: 'linge_2', type: 'sock2', station: 'fil_linge' },
  { id: 'linge_3', type: 'underwear', station: 'fil_linge' },
  { id: 'linge_4', type: 'towel', station: 'fil_linge' },
  // Toys (scattered in the kids room)
  { id: 'jouet_nounours', type: 'teddy', x: -12.2, z: 2.6, rot: 0.6 },
  { id: 'jouet_voiture', type: 'toycar', x: -9.6, z: 3.3, rot: 2.1 },
  { id: 'jouet_canard', type: 'duck', x: -10.6, z: 4.3, rot: -0.8 },
  { id: 'jouet_dino', type: 'dino', x: -12.6, z: 3.8, rot: 1.4 },
  // Food
  { id: 'croissants', type: 'croissants', station: 'plan_travail' },
  { id: 'baguette', type: 'baguette', station: 'boulangerie' },
  // Task objects
  { id: 'courrier', type: 'letter', station: 'boite_lettres' },
  { id: 'sac_poubelle', type: 'trash_bag', x: 0.3, z: -0.55, rot: 0.3 },
  { id: 'vaisselle', type: 'dishes', station: 'placard' },
  { id: 'balle', type: 'ball', x: -3.0, z: 12.0 },
  { id: 'arrosoir', type: 'watering_can', x: 4.9, z: 6.8, rot: -1.2 },
  // Knockables
  { id: 'vase_salon', type: 'vase', x: 3.55, z: 2.65, y: 0.42 },
  { id: 'vase_entree', type: 'vase', x: -5.3, z: 0.3, y: 0.85 },
  { id: 'plante_salon', type: 'plant', x: 5.45, z: 5.45 },
  { id: 'plante_baie', type: 'plant', x: -1.55, z: 5.5 },
  { id: 'plante_entree', type: 'plant', x: -7.55, z: 5.4 },
  { id: 'coussin_1', type: 'cushion', x: 2.15, z: 1.85, y: 0.45 },
  { id: 'coussin_2', type: 'cushion', x: 2.15, z: 2.95, y: 0.45 },
  { id: 'tour_cubes', type: 'toy_tower', x: -9.4, z: 1.4 },
  { id: 'bin_cuisine', type: 'kitchen_bin', x: 0.95, z: -0.45 },
  { id: 'pot_terrasse_1', type: 'flowerpot', x: -1.6, z: 6.65 },
  { id: 'pot_terrasse_2', type: 'flowerpot', x: 5.3, z: 9.2 },
  { id: 'pot_devant', type: 'flowerpot', x: -5.45, z: -6.65 },
  { id: 'bin_jardin', type: 'wheelie_bin', x: 9.95, z: 3.0 },
  { id: 'bin_rue', type: 'wheelie_bin', x: 4.8, z: -14.0 },
  { id: 'bin_voisin_1', type: 'wheelie_bin', x: 17.9, z: -12.3 },
  { id: 'bin_voisin_2', type: 'wheelie_bin', x: 18.8, z: -12.3 },
  { id: 'nain', type: 'gnome', x: 23.5, z: -7.0 },
  { id: 'pot_voisin_1', type: 'flowerpot', x: 19.0, z: -5.7 },
  { id: 'pot_voisin_2', type: 'flowerpot', x: 21.0, z: -5.7 },
  { id: 'bin_square', type: 'public_bin', x: -16.0, z: 4.2 },
  { id: 'seau', type: 'watering_pot', x: -9.7, z: 18.4 },
];

export const PUDDLES: Puddle[] = [
  { id: 'flaque_jardin', x: 1.6, z: 18.3, r: 1.35 },
  { id: 'flaque_square', x: -19.6, z: 18.4, r: 1.05 },
];

export const SPAWNS: { tofu: Spawn; humans: Spawn[] } = {
  tofu: { x: -4.25, z: 5.0, facing: Math.PI * 0.75 },
  humans: [
    { x: -6.5, z: -2.0, facing: 0 },
    { x: -6.5, z: -0.6, facing: 0 },
  ],
};

// --- Cat navigation graph (hand authored, validated by tests) ---
export const CAT_NODES: CatNode[] = [
  // Neighbors
  { id: 'n_drive', x: 16.5, z: -12.0, y: 0 },
  { id: 'n_lawn', x: 24.0, z: -9.5, y: 0 },
  { id: 'n_door', x: 20.0, z: -6.3, y: 0 },
  { id: 'n_corner', x: 11.4, z: -12.0, y: 0 },
  { id: 'n_car_roof', x: 15.0, z: -9.0, y: 1.5, perch: true },
  { id: 'n_wall_top', x: 26.0, z: -13.0, y: 1.0, perch: true },
  // Stone wall between the alley/garden and the neighbors
  { id: 'stone_n', x: 10.5, z: -11.0, y: 1.7, perch: true },
  { id: 'stone_m', x: 10.5, z: 0.0, y: 1.7, perch: true },
  { id: 'stone_s', x: 10.5, z: 12.0, y: 1.7, perch: true },
  { id: 'stone_end', x: 10.5, z: 20.0, y: 1.7, perch: true },
  { id: 'shed_roof', x: 8.3, z: 20.0, y: 2.55, perch: true },
  // Garden
  { id: 'g_shed', x: 6.0, z: 19.5, y: 0 },
  { id: 'g_east', x: 8.4, z: 12.0, y: 0 },
  { id: 'g_center', x: 2.0, z: 13.0, y: 0 },
  { id: 'g_terrace', x: 0.5, z: 7.5, y: 0 },
  { id: 'g_west', x: -8.0, z: 11.0, y: 0 },
  { id: 'g_hole', x: -12.9, z: 15.1, y: 0 },
  { id: 'g_south', x: -4.0, z: 19.0, y: 0 },
  { id: 'g_tree', x: -1.5, z: 15.5, y: 2.2, perch: true },
  { id: 'g_backdoor', x: -6.5, z: 7.1, y: 0 },
  { id: 'g_gate', x: 8.25, z: 7.1, y: 0 },
  { id: 'fence_top', x: 10.0, z: 6.0, y: 1.3, perch: true },
  // Alley
  { id: 'a_south', x: 8.25, z: 4.5, y: 0 },
  { id: 'a_mid', x: 8.25, z: -3.5, y: 0 },
  { id: 'a_side', x: 6.75, z: -6.0, y: 0 },
  { id: 'a_car_roof', x: 8.25, z: -8.5, y: 1.5, perch: true },
  { id: 'a_front', x: 6.75, z: -11.6, y: 0 },
  { id: 'portail_top', x: 10.0, z: -13.0, y: 1.0, perch: true },
  // Front yard
  { id: 'f_door', x: -6.5, z: -7.3, y: 0 },
  { id: 'f_center', x: -2.0, z: -9.5, y: 0 },
  { id: 'f_window', x: -2.0, z: -7.0, y: 0 },
  { id: 'f_wall_top', x: -9.0, z: -13.0, y: 1.0, perch: true },
  // Street
  { id: 's_front', x: 8.25, z: -14.3, y: 0 },
  { id: 's_east', x: 15.0, z: -14.3, y: 0 },
  { id: 's_far_east', x: 26.0, z: -14.3, y: 0 },
  { id: 's_mid', x: -6.0, z: -14.3, y: 0 },
  { id: 's_mid_w', x: -10.0, z: -14.3, y: 0 },
  { id: 's_west', x: -21.5, z: -14.3, y: 0 },
  { id: 'road_mid', x: -6.0, z: -19.5, y: 0 },
  { id: 'road_west', x: -17.0, z: -19.4, y: 0 },
  { id: 'road_east', x: 24.5, z: -19.4, y: 0 },
  { id: 'car1_roof', x: -17.0, z: -21.9, y: 1.5, perch: true },
  { id: 'car2_roof', x: 21.0, z: -21.9, y: 1.5, perch: true },
  { id: 'n_bakery', x: -6.0, z: -24.1, y: 0 },
  { id: 'n_side_e', x: 24.5, z: -24.1, y: 0 },
  // Square
  { id: 'sq_entry', x: -21.5, z: -11.0, y: 0 },
  { id: 'sq_bench', x: -17.0, z: 2.0, y: 0 },
  { id: 'sq_tree', x: -21.0, z: 6.0, y: 2.6, perch: true },
  { id: 'sq_west', x: -26.5, z: 3.6, y: 0 },
  { id: 'sq_wall_top', x: -28.5, z: 3.6, y: 2.2, perch: true },
  { id: 'sq_south', x: -20.0, z: 15.3, y: 0 },
  { id: 'sq_hole', x: -15.1, z: 15.1, y: 0 },
  // House (cat can sneak in through the dog flap and leave through the kitchen window)
  { id: 'h_back_in', x: -6.5, z: 5.0, y: 0, indoor: true },
  { id: 'h_hall_s', x: -6.5, z: 3.0, y: 0, indoor: true },
  { id: 'h_hall_mid', x: -6.5, z: 0.0, y: 0, indoor: true },
  { id: 'h_hall_n', x: -6.5, z: -3.0, y: 0, indoor: true },
  { id: 'h_front_in', x: -6.5, z: -5.0, y: 0, indoor: true },
  { id: 'h_kitchen', x: -3.0, z: -3.6, y: 0, indoor: true },
  { id: 'h_counter', x: -2.0, z: -5.5, y: 0.95, perch: true, indoor: true },
  { id: 'h_fridge', x: -4.5, z: -5.45, y: 1.88, perch: true, indoor: true },
  { id: 'h_window', x: -2.0, z: -6.0, y: 1.08, perch: true, indoor: true },
  { id: 'h_living', x: 0.0, z: 4.0, y: 0, indoor: true },
];

export const CAT_EDGES: CatEdge[] = [
  { a: 'n_drive', b: 'n_lawn' }, { a: 'n_drive', b: 'n_corner' }, { a: 'n_lawn', b: 'n_door' }, { a: 'n_door', b: 'n_drive' },
  { a: 'n_drive', b: 'n_car_roof', jump: true }, { a: 'n_lawn', b: 'n_wall_top', jump: true },
  { a: 'n_wall_top', b: 's_far_east', jump: true },
  { a: 'n_corner', b: 'stone_n', jump: true }, { a: 'stone_n', b: 'stone_m' }, { a: 'stone_m', b: 'stone_s' },
  { a: 'stone_s', b: 'stone_end' }, { a: 'stone_end', b: 'shed_roof', jump: true }, { a: 'shed_roof', b: 'g_shed', jump: true },
  { a: 'stone_n', b: 'a_front', jump: true }, { a: 'stone_m', b: 'a_mid', jump: true }, { a: 'stone_s', b: 'g_east', jump: true },
  { a: 'a_front', b: 'a_side' }, { a: 'a_side', b: 'a_mid' }, { a: 'a_mid', b: 'a_south' },
  { a: 'a_side', b: 'a_car_roof', jump: true },
  { a: 'a_south', b: 'g_gate', door: 'portillon' },
  { a: 'a_south', b: 'fence_top', jump: true }, { a: 'fence_top', b: 'g_gate', jump: true },
  { a: 'a_front', b: 's_front', door: 'portail' },
  { a: 'a_front', b: 'portail_top', jump: true }, { a: 'portail_top', b: 's_front', jump: true },
  { a: 'g_gate', b: 'g_east' }, { a: 'g_gate', b: 'g_terrace' }, { a: 'g_east', b: 'g_center' },
  { a: 'g_center', b: 'g_tree', jump: true }, { a: 'g_center', b: 'g_south' }, { a: 'g_center', b: 'g_west' },
  { a: 'g_center', b: 'g_terrace' }, { a: 'g_south', b: 'g_shed' }, { a: 'g_west', b: 'g_hole' },
  { a: 'g_west', b: 'g_backdoor' }, { a: 'g_backdoor', b: 'g_terrace' }, { a: 'g_shed', b: 'g_east' },
  { a: 'g_hole', b: 'sq_hole' },
  { a: 'sq_hole', b: 'sq_south' }, { a: 'sq_south', b: 'sq_bench' }, { a: 'sq_bench', b: 'sq_tree', jump: true },
  { a: 'sq_bench', b: 'sq_entry' }, { a: 'sq_bench', b: 'sq_west' }, { a: 'sq_west', b: 'sq_wall_top', jump: true },
  { a: 'sq_entry', b: 's_west' },
  { a: 's_west', b: 'road_west' }, { a: 's_west', b: 's_mid_w' }, { a: 's_mid_w', b: 's_mid' }, { a: 's_mid', b: 's_front' },
  { a: 's_front', b: 's_east' }, { a: 's_east', b: 'n_drive' }, { a: 's_east', b: 'road_east' }, { a: 's_far_east', b: 's_east' },
  { a: 's_far_east', b: 'road_east' },
  { a: 's_mid', b: 'road_mid' }, { a: 'road_mid', b: 'n_bakery' }, { a: 'road_mid', b: 'road_west' }, { a: 'road_mid', b: 'road_east' },
  { a: 'road_west', b: 'car1_roof', jump: true }, { a: 'road_east', b: 'car2_roof', jump: true }, { a: 'road_east', b: 'n_side_e' },
  { a: 'n_bakery', b: 'n_side_e' },
  { a: 's_mid_w', b: 'f_wall_top', jump: true }, { a: 'f_wall_top', b: 'f_center', jump: true },
  { a: 'f_center', b: 'f_door' }, { a: 'f_center', b: 'f_window' }, { a: 'f_center', b: 'a_front' },
  { a: 'f_window', b: 'h_window', jump: true },
  // Indoors
  { a: 'g_backdoor', b: 'h_back_in', flap: 'porte_arriere' },
  { a: 'h_back_in', b: 'h_hall_s' }, { a: 'h_hall_s', b: 'h_hall_mid' }, { a: 'h_hall_mid', b: 'h_hall_n' },
  { a: 'h_hall_n', b: 'h_front_in' }, { a: 'h_front_in', b: 'f_door', door: 'porte_entree' },
  { a: 'h_hall_n', b: 'h_kitchen', door: 'porte_cuisine' }, { a: 'h_kitchen', b: 'h_counter', jump: true },
  { a: 'h_counter', b: 'h_fridge', jump: true }, { a: 'h_counter', b: 'h_window', jump: true },
  { a: 'h_kitchen', b: 'h_living' }, { a: 'h_living', b: 'h_hall_s', door: 'porte_salon' },
  { a: 'h_living', b: 'g_terrace', door: 'baie' },
];

export const CAT_START = 'n_lawn';

/** Returns the zone at a position (first match), or null outside every zone. */
export function zoneAt(x: number, z: number): Zone | null {
  for (const zn of ZONES) {
    if (x >= zn.x0 && x < zn.x1 && z >= zn.z0 && z < zn.z1) return zn;
  }
  return null;
}

export function zoneById(id: string): Zone | undefined {
  return ZONES.find((z) => z.id === id);
}

export function isIndoor(x: number, z: number): boolean {
  const zn = zoneAt(x, z);
  return !!zn && zn.indoor;
}

/** House footprint used for roof hiding and "inside the house" checks. */
export const HOUSE_RECT = { x0: -14, z0: -6, x1: 6, z1: 6 };

export function inHouse(x: number, z: number): boolean {
  return x > HOUSE_RECT.x0 && x < HOUSE_RECT.x1 && z > HOUSE_RECT.z0 && z < HOUSE_RECT.z1;
}
