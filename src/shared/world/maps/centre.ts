// "Le centre commercial": the shopping center on its opening day.
//
// Coordinates are meters. x grows east, z grows south, y is up.
// An avenue and the car park lie north. The mall stands south of its forecourt
// (parvis): a central gallery with a fountain, two shops on each side, the
// toilets and the stockroom at the back, the delivery yard on the east side.
//
//      N (z-)   avenue                                   <- z = -27.5
//               parking
//               parvis (forecourt)                       <- z = -10 .. -7
//   talus | Mode    | galerie | Café        | livraison
//         | Jouets  | (fountain) | Supermarché |
//         |         | WC | réserve |          |
//      S (z+)                                            <- z = 18

import type { MapDef } from '../mapTypes';
import type {
  CatEdge, CatNode, DoorDef, FloorPatch, ItemPlacement, PropDef, Puddle, Spawn, StationDef, WallDef, Zone,
} from '../types';

const BOUNDS = { x0: -30.5, z0: -27.5, x1: 30.5, z1: 18.5 };

const ZONES: Zone[] = [
  { id: 'toilettes', name: 'les toilettes', label: 'Toilettes', indoor: true, x0: -8, z0: 13, x1: -1, z1: 18, floor: 'white_tiles', wallColor: 0xbde4dd },
  { id: 'reserve', name: 'la réserve', label: 'Réserve', indoor: true, x0: 1, z0: 13, x1: 8, z1: 18, floor: 'cement_tiles', wallColor: 0xd5d8dc },
  { id: 'mode', name: 'la boutique de vêtements', label: 'Boutique Mode', indoor: true, x0: -26, z0: -7, x1: -8, z1: 5, floor: 'parquet_light', wallColor: 0xf5dfe4 },
  { id: 'jouets', name: 'le magasin de jouets', label: 'Magasin de jouets', indoor: true, x0: -26, z0: 5, x1: -8, z1: 18, floor: 'carpet', wallColor: 0xd6eaf8 },
  { id: 'cafe', name: 'le café', label: 'Café-pâtisserie', indoor: true, x0: 8, z0: -7, x1: 26, z1: 5, floor: 'tomettes', wallColor: 0xf6e3b4 },
  { id: 'superette', name: 'le supermarché', label: 'Supermarché', indoor: true, x0: 8, z0: 5, x1: 26, z1: 18, floor: 'white_tiles', wallColor: 0xe3f4ea },
  { id: 'galerie', name: 'la galerie', label: 'Galerie', indoor: true, x0: -8, z0: -7, x1: 8, z1: 18, floor: 'cement_tiles', wallColor: 0xf3ede2 },
  { id: 'parvis', name: 'le parvis', label: 'Parvis', indoor: false, x0: -30.5, z0: -10, x1: 30.5, z1: -7 },
  { id: 'talus', name: 'le talus', label: 'Talus', indoor: false, x0: -30.5, z0: -7, x1: -26, z1: 18.5 },
  { id: 'livraison', name: 'la cour de livraison', label: 'Cour de livraison', indoor: false, x0: 26, z0: -7, x1: 30.5, z1: 18.5 },
  { id: 'parking', name: 'le parking', label: 'Parking', indoor: false, x0: -30.5, z0: -21, x1: 30.5, z1: -10 },
  { id: 'trottoir', name: 'le trottoir', label: 'Trottoir', indoor: false, x0: -30.5, z0: -23, x1: 30.5, z1: -21 },
  { id: 'rue', name: "l'avenue", label: 'Avenue du Commerce', indoor: false, x0: -30.5, z0: -27.5, x1: 30.5, z1: -23 },
];

const OUTSIDE = ['parking', 'trottoir', 'rue'];

const FLOORS: FloorPatch[] = [
  { kind: 'parquet_light', x0: -26, z0: -7, x1: -8, z1: 5, rot: 1 },
  { kind: 'carpet', x0: -26, z0: 5, x1: -8, z1: 18 },
  { kind: 'tomettes', x0: 8, z0: -7, x1: 26, z1: 5 },
  { kind: 'white_tiles', x0: 8, z0: 5, x1: 26, z1: 18 },
  { kind: 'cement_tiles', x0: -8, z0: -7, x1: 8, z1: 18 },
  { kind: 'white_tiles', x0: -8, z0: 13, x1: -1, z1: 18, y: 0.002 },
  { kind: 'terrace', x0: 1, z0: 13, x1: 8, z1: 18, y: 0.002 },
  { kind: 'pavers', x0: -30.5, z0: -10, x1: 30.5, z1: -7 },
  { kind: 'asphalt', x0: 26, z0: -7, x1: 30.5, z1: 18.5 },
  { kind: 'asphalt', x0: -30.5, z0: -21, x1: 30.5, z1: -10 },
  { kind: 'sidewalk', x0: -30.5, z0: -23, x1: 30.5, z1: -21 },
  { kind: 'asphalt', x0: -30.5, z0: -27.5, x1: 30.5, z1: -23 },
];

const FACADE = 0xe9e4da;
const NO_SHUTTER = -1;
const SHOP_WIN = (at: number, width: number) => ({ at, width, kind: 'window' as const, sill: 0.35, top: 2.45 });
const HIGH_WIN = (at: number, width = 1.6) => ({ at, width, kind: 'window' as const, sill: 1.5, top: 2.3 });
const ARCH = (at: number, width = 3.0) => ({ at, width, kind: 'arch' as const });

const WALLS: WallDef[] = [
  // --- Mall exterior ---
  { id: 'b_north', x0: -26, z0: -7, x1: 26, z1: -7, style: 'house_ext', color: FACADE, shutter: NO_SHUTTER, openings: [
    SHOP_WIN(4, 4.4), SHOP_WIN(12, 4.4), { at: 26, width: 3.6, kind: 'door', door: 'entree' }, SHOP_WIN(40, 4.4), SHOP_WIN(48, 4.4),
  ] },
  { id: 'b_south', x0: -26, z0: 18, x1: 26, z1: 18, style: 'house_ext', color: FACADE, shutter: NO_SHUTTER, openings: [
    HIGH_WIN(9), HIGH_WIN(43),
  ] },
  { id: 'b_west', x0: -26, z0: -7, x1: -26, z1: 18, style: 'house_ext', color: FACADE, shutter: NO_SHUTTER, openings: [
    HIGH_WIN(5), HIGH_WIN(17),
  ] },
  { id: 'b_east', x0: 26, z0: -7, x1: 26, z1: 18, style: 'house_ext', color: FACADE, shutter: NO_SHUTTER, openings: [
    HIGH_WIN(5), { at: 22.5, width: 1.4, kind: 'door', door: 'porte_livraison' },
  ] },
  // --- Shop fronts on the gallery ---
  { id: 'i_mode', x0: -8, z0: -7, x1: -8, z1: 5, style: 'house_int', openings: [SHOP_WIN(2.6, 3.4), ARCH(6), SHOP_WIN(9.6, 3.4)] },
  { id: 'i_jouets', x0: -8, z0: 5, x1: -8, z1: 13, style: 'house_int', openings: [SHOP_WIN(1.6, 2.2), ARCH(4.5)] },
  { id: 'i_jouets_wc', x0: -8, z0: 13, x1: -8, z1: 18, style: 'house_int' },
  { id: 'i_cafe', x0: 8, z0: -7, x1: 8, z1: 5, style: 'house_int', openings: [SHOP_WIN(2.6, 3.4), ARCH(6), SHOP_WIN(9.6, 3.4)] },
  { id: 'i_superette', x0: 8, z0: 5, x1: 8, z1: 13, style: 'house_int', openings: [SHOP_WIN(1.6, 2.2), ARCH(4.5)] },
  { id: 'i_superette_res', x0: 8, z0: 13, x1: 8, z1: 18, style: 'house_int' },
  { id: 'i_mode_jouets', x0: -26, z0: 5, x1: -8, z1: 5, style: 'house_int' },
  { id: 'i_cafe_superette', x0: 8, z0: 5, x1: 26, z1: 5, style: 'house_int' },
  // --- Back rooms ---
  { id: 'i_wc_n', x0: -8, z0: 13, x1: -1, z1: 13, style: 'house_int', openings: [{ at: 3.75, width: 1.2, kind: 'door', door: 'porte_toilettes' }] },
  { id: 'i_wc_e', x0: -1, z0: 13, x1: -1, z1: 18, style: 'house_int' },
  { id: 'i_res_n', x0: 1, z0: 13, x1: 8, z1: 13, style: 'house_int', openings: [{ at: 3.25, width: 1.2, kind: 'door', door: 'porte_reserve' }] },
  { id: 'i_res_w', x0: 1, z0: 13, x1: 1, z1: 18, style: 'house_int' },
  // --- Grounds ---
  { id: 'h_south_w', x0: -30.8, z0: 18.2, x1: -26, z1: 18.2, style: 'hedge' },
  { id: 'h_south_e', x0: 26, z0: 18.2, x1: 30.8, z1: 18.2, style: 'hedge' },
  { id: 'e_west', x0: -30.8, z0: -27.5, x1: -30.8, z1: 18.2, style: 'hedge', height: 2.4 },
  { id: 'e_east', x0: 30.8, z0: -27.5, x1: 30.8, z1: 18.2, style: 'hedge', height: 2.4 },
];

const DOORS: DoorDef[] = [
  { id: 'entree', name: "l'entrée de la galerie", kind: 'bay', x: 0, z: -7, axis: 'x', width: 3.6, hinge: 1, swing: 1, dogCanPush: false, dogFlap: false, open: true },
  { id: 'porte_livraison', name: 'la porte de la cour de livraison', kind: 'exterior', x: 26, z: 15.5, axis: 'z', width: 1.4, hinge: -1, swing: -1, dogCanPush: true, dogFlap: false, open: false, color: 0x7f8c8d },
  { id: 'porte_toilettes', name: 'la porte des toilettes', kind: 'interior', x: -4.25, z: 13, axis: 'x', width: 1.2, hinge: -1, swing: 1, dogCanPush: true, dogFlap: false, open: true, color: 0xf4efe4 },
  { id: 'porte_reserve', name: 'la porte de la réserve', kind: 'interior', x: 4.25, z: 13, axis: 'x', width: 1.2, hinge: 1, swing: 1, dogCanPush: true, dogFlap: false, open: true, color: 0x95a5a6 },
];

const CARS: PropDef[] = [
  ...[-22, -16, -7, 9, 18, 24].map((x, i): PropDef => ({ type: 'car', x, z: -13, rot: 2, color: [0xd2483a, 0x6aa5c9, 0xf2c94c, 0x8fbf6a, 0xf5f6fa, 0x3d6fa8][i], v: i % 3 })),
  ...[-19, -4, 6, 15, 21].map((x, i): PropDef => ({ type: 'car', x, z: -18.3, rot: 0, color: [0x2d3436, 0xe67e22, 0x9b59b6, 0x16a085, 0xc0392b][i], v: (i + 1) % 3 })),
];

const PROPS: PropDef[] = [
  // --- Boutique Mode ---
  { type: 'clothes_rack', x: -20, z: -3 },
  { type: 'clothes_rack', x: -14, z: 1.5 },
  { type: 'fitting_room', x: -25.1, z: 3.6, rot: 1 },
  { type: 'fitting_room', x: -25.1, z: 1.8, rot: 1 },
  { type: 'display_table', x: -17, z: -5.0 },
  { type: 'display_table', x: -11.5, z: -2.5 },
  { type: 'checkout', x: -11.5, z: 3.9, rot: 2 },
  { type: 'rug', x: -18, z: -0.6, w: 4, d: 3, color: 0xe8a3b5 },
  { type: 'pot_decor', x: -25.3, z: -6.3 },
  // --- Magasin de jouets ---
  { type: 'shop_shelf', x: -25.55, z: 8.0, rot: 1, color: 0xfdfdfd, color2: 0x3498db },
  { type: 'shop_shelf', x: -25.55, z: 12.0, rot: 1, color: 0xfdfdfd, color2: 0xe74c3c },
  { type: 'shop_shelf', x: -25.55, z: 15.6, rot: 1, color: 0xfdfdfd, color2: 0xf1c40f },
  { type: 'shop_shelf', x: -18, z: 11, w: 3.0, color: 0xfdfdfd, color2: 0x2ecc71 },
  { type: 'display_table', x: -13, z: 9.5, v: 1 },
  { type: 'spring_rider', x: -11.5, z: 13.2 },
  { type: 'checkout', x: -12.5, z: 16.9, rot: 2 },
  { type: 'dog_basket', x: -9.6, z: 16.6 },
  { type: 'rug_round', x: -18, z: 15.2, w: 2.6, d: 2.6, color: 0xf6c453 },
  // --- Café-pâtisserie ---
  { type: 'bakery_stand', x: 17, z: 3.95, rot: 2 },
  { type: 'counter', x: 25.55, z: -1.0, w: 3.0, rot: 3 },
  { type: 'fridge', x: 25.45, z: 3.9, rot: 3 },
  ...[[12, -4], [12, 0], [16, -4], [16, 0], [20.5, -4]].flatMap(([x, z]): PropDef[] => [
    { type: 'cafe_table', x, z },
    { type: 'garden_chair', x: x - 0.75, z, rot: 1, color: 0x8b5a3c },
    { type: 'garden_chair', x: x + 0.75, z, rot: 3, color: 0x8b5a3c },
  ]),
  { type: 'dog_basket', x: 24.4, z: 2.3 },
  { type: 'picture', x: 17, z: 4.92, rot: 2, color: 0xd9a35b },
  // --- Supermarché ---
  { type: 'shop_shelf', x: 14, z: 9.5, w: 3.6, v: 1, color: 0xecf0f1, color2: 0x27ae60 },
  { type: 'shop_shelf', x: 14, z: 13.5, w: 3.6, v: 1, color: 0xecf0f1, color2: 0xe67e22 },
  { type: 'shop_shelf', x: 20.5, z: 9.5, w: 3.6, v: 1, color: 0xecf0f1, color2: 0x2980b9 },
  { type: 'shop_shelf', x: 20.5, z: 13.5, w: 3.6, v: 1, color: 0xecf0f1, color2: 0xc0392b },
  { type: 'shop_shelf', x: 25.55, z: 9.5, rot: 3, w: 3.0, v: 1, color: 0xecf0f1, color2: 0x8e44ad },
  { type: 'checkout', x: 12, z: 16.9, rot: 2 },
  { type: 'checkout', x: 16, z: 16.9, rot: 2 },
  // --- Galerie ---
  { type: 'fountain', x: 0, z: 4.5 },
  { type: 'bench', x: -5.5, z: 4.5, rot: 1 },
  { type: 'bench', x: 5.5, z: 4.5, rot: 3 },
  { type: 'trestle_table', x: 0, z: -2.6 },
  { type: 'pot_decor', x: -7.3, z: -6.3 },
  { type: 'pot_decor', x: 7.3, z: -6.3 },
  { type: 'pot_decor', x: -7.3, z: 12.3 },
  { type: 'pot_decor', x: 7.3, z: 12.3 },
  { type: 'vacuum_dock', x: 0, z: 17.78, rot: 2 },
  // --- Toilettes ---
  { type: 'toilet', x: -6.5, z: 17.52, rot: 2 },
  { type: 'toilet', x: -3.0, z: 17.52, rot: 2 },
  { type: 'vanity', x: -7.68, z: 14.6, rot: 1 },
  { type: 'roll_holder', x: -4.9, z: 17.79, rot: 2 },
  // --- Réserve ---
  { type: 'shop_shelf', x: 6.2, z: 17.5, rot: 2, w: 3.0, v: 1, color: 0x95a5a6, color2: 0x7f8c8d },
  { type: 'teacher_desk', x: 2.0, z: 15.5, rot: 1 },
  { type: 'chair', x: 2.9, z: 15.5, rot: 3, color: 0x2d3436 },
  // --- Parvis ---
  { type: 'flowerbed', x: -9.5, z: -8.5, w: 4.0, d: 1.2 },
  { type: 'flowerbed', x: 9.5, z: -8.5, w: 4.0, d: 1.2 },
  { type: 'cart_shelter', x: -16, z: -8.6 },
  { type: 'bench', x: -4, z: -9.6, rot: 2 },
  { type: 'bench', x: 4, z: -9.6, rot: 2 },
  { type: 'bike', x: 23.5, z: -8.6, rot: 1 },
  { type: 'streetlamp', x: -13.6, z: -10.4 },
  { type: 'streetlamp', x: 13.6, z: -10.4 },
  { type: 'streetlamp', x: -26, z: -10.4 },
  { type: 'streetlamp', x: 26, z: -10.4 },
  // --- Parking & avenue ---
  ...CARS,
  { type: 'plane_tree', x: -24, z: -22.4 },
  { type: 'plane_tree', x: -6, z: -22.4 },
  { type: 'plane_tree', x: 6, z: -22.4 },
  { type: 'plane_tree', x: 24, z: -22.4 },
  // --- Talus ---
  { type: 'tree', x: -29.3, z: 0 },
  { type: 'tree', x: -29.3, z: 10, v: 1 },
  { type: 'bush', x: -28.0, z: 16.8 },
  { type: 'bush', x: -29.6, z: -5.0, v: 1 },
  // --- Cour de livraison ---
  { type: 'bush', x: 29.6, z: -5.6 },
];

const BASKET_SLOTS: [number, number, number][] = [[-0.2, 0.15, -0.1], [0.2, 0.15, 0.1], [0.0, 0.18, 0.25], [-0.25, 0.2, 0.25], [0.25, 0.2, -0.2]];
const RACK_SLOTS: [number, number, number][] = [[-0.55, 1.45, 0], [-0.18, 1.45, 0], [0.18, 1.45, 0], [0.55, 1.45, 0]];

const STATIONS: StationDef[] = [
  { id: 'portant_1', kind: 'clothes_rack', name: 'le portant de la boutique', x: -20, z: -3, y: 1.45, r: 0.8, hw: 0.8, hd: 0.25, dogReach: true, capacity: 4, slots: RACK_SLOTS },
  { id: 'portant_2', kind: 'clothes_rack', name: 'le portant du fond', x: -14, z: 1.5, y: 1.45, r: 0.8, hw: 0.8, hd: 0.25, dogReach: true, capacity: 4, slots: RACK_SLOTS },
  { id: 'rayon_jouets', kind: 'shop_shelf', name: 'le rayon des jouets', x: -18, z: 11.45, y: 0.75, r: 0.9, hw: 1.5, hd: 0.15, dogReach: true, capacity: 6,
    slots: [[-1.1, 0.72, -0.05], [-0.45, 0.72, -0.05], [0.2, 0.72, -0.05], [0.85, 0.72, -0.05], [-0.75, 1.22, -0.1], [0.55, 1.22, -0.1]] },
  { id: 'comptoir', kind: 'counter', name: 'le comptoir du café', x: 25.4, z: -1.4, y: 0.92, r: 0.95, hw: 0.3, hd: 0.5, dogReach: true, capacity: 2 },
  { id: 'bocal', kind: 'treat_jar', name: 'le bocal de friandises', x: 25.4, z: 0.15, y: 0.92, r: 0.95, hw: 0.3, hd: 0.3 },
  { id: 'boulangerie', kind: 'bakery', name: 'la pâtisserie', x: 17, z: 3.95, y: 0.95, r: 1.0, hw: 1.2, hd: 0.35, dogReach: true, capacity: 3,
    slots: [[-0.7, 0.95, 0], [0.0, 0.95, 0], [0.7, 0.95, 0]] },
  { id: 'buffet', kind: 'garden_table', name: "le buffet de l'inauguration", x: 0, z: -2.6, y: 0.78, r: 1.0, hw: 1.0, hd: 0.4, dogReach: true, capacity: 2 },
  { id: 'ruban', kind: 'bed', name: 'le ruban', x: 0, z: -5.6, y: 1.0, r: 0.9, hw: 1.6, hd: 0.08,
    make: { verb: 'Tendre le ruban', jump: 'Mordiller le ruban', undone: 'Ruban arraché !', look: 'ribbon' } },
  { id: 'caisse', kind: 'checkout', name: 'la caisse du supermarché', x: 12, z: 16.3, y: 0.97, r: 0.9, hw: 0.9, hd: 0.2, dogReach: true, capacity: 1 },
  { id: 'coffre', kind: 'cupboard', name: 'le bureau du gérant', x: 2.0, z: 15.5, y: 0.78, r: 0.9, hw: 0.35, hd: 0.7, dogReach: false, capacity: 1 },
  { id: 'benne', kind: 'street_bin', name: 'la benne', x: 28.6, z: 10.5, y: 1.0, r: 1.5, dogReach: false, linkedItem: 'benne', capacity: 2 },
  { id: 'jardiniere_ouest', kind: 'flowerbed', name: 'la jardinière ouest', x: -9.5, z: -8.5, y: 0.2, r: 0.9, hw: 2.0, hd: 0.6 },
  { id: 'jardiniere_est', kind: 'flowerbed', name: 'la jardinière est', x: 9.5, z: -8.5, y: 0.2, r: 0.9, hw: 2.0, hd: 0.6 },
  { id: 'robinet', kind: 'tap', name: 'le robinet', x: 13.6, z: -7.45, y: 0.8, r: 1.0 },
  { id: 'derouleur', kind: 'roll_holder', name: 'le dérouleur de papier', x: -4.9, z: 17.72, y: 0.56, r: 0.8, dogReach: true, capacity: 1 },
  { id: 'panier_tofu', kind: 'dog_basket', name: 'le panier de Tofu', x: 24.4, z: 2.3, y: 0.12, r: 0.95, capacity: 20, slots: BASKET_SLOTS },
  { id: 'coin_enfants', kind: 'dog_basket', name: 'le coin des enfants', x: -9.6, z: 16.6, y: 0.12, r: 0.95, capacity: 20, slots: BASKET_SLOTS },
];

const ITEMS: ItemPlacement[] = [
  // Clothes of the boutique, left everywhere.
  { id: 'robe', type: 'dress', x: -3.2, z: 10.6, rot: 0.6 },
  { id: 'jean', type: 'jeans', x: -20.5, z: 14.0, rot: 1.2 },
  { id: 'chapeau', type: 'hat', x: -11.0, z: -12.4, rot: 0.3 },
  { id: 'mariniere', type: 'tshirt', x: 14.0, z: -2.0, rot: -0.7 },
  { id: 'casquette', type: 'cap', station: 'portant_2' },
  { id: 'robe_2', type: 'dress', station: 'portant_2' },
  // Toys of the toy shop.
  { id: 'nounours', type: 'teddy', x: -12.0, z: 7.4, rot: 0.6 },
  { id: 'voiture', type: 'toycar', x: -21.0, z: 16.6, rot: 2.1 },
  { id: 'canard', type: 'duck', x: 3.2, z: 7.8, rot: -0.8 },
  { id: 'dino', type: 'dino', x: -23.0, z: 6.3, rot: 1.4 },
  // Job objects.
  { id: 'gateau', type: 'cake', station: 'comptoir' },
  { id: 'cartons', type: 'cardboard', x: 5.2, z: 14.4, rot: 0.2 },
  { id: 'fond_caisse', type: 'cash_box', station: 'coffre' },
  { id: 'arrosoir', type: 'watering_can', x: 12.4, z: -8.3, rot: -1.2 },
  { id: 'papier_toilette', type: 'toilet_roll', station: 'derouleur' },
  { id: 'baguette', type: 'baguette', station: 'boulangerie' },
  { id: 'croissants', type: 'croissants', station: 'comptoir' },
  { id: 'balle', type: 'ball', x: -15.5, z: 13.6 },
  // Knockables.
  { id: 'mannequin_1', type: 'mannequin', x: -22.5, z: -6.0, rot: 3.1 },
  { id: 'mannequin_2', type: 'mannequin', x: -14.0, z: -6.0, rot: 3.0 },
  { id: 'mannequin_3', type: 'mannequin', x: -9.2, z: -5.6, rot: 2.4 },
  { id: 'conserves_1', type: 'can_pyramid', x: 10.6, z: 7.0 },
  { id: 'conserves_2', type: 'can_pyramid', x: 17.2, z: 11.5 },
  { id: 'conserves_3', type: 'can_pyramid', x: 23.2, z: 7.0 },
  { id: 'caddie_1', type: 'cart', x: 10.2, z: 12.0, rot: 1.6 },
  { id: 'caddie_2', type: 'cart', x: -10.6, z: -15.8, rot: 0.4 },
  { id: 'caddie_3', type: 'cart', x: 3.0, z: -11.6, rot: 2.6 },
  { id: 'caddie_4', type: 'cart', x: 19.5, z: -15.6, rot: 1.1 },
  { id: 'tour_cubes', type: 'toy_tower', x: -14.0, z: 14.4 },
  { id: 'tour_cubes_2', type: 'toy_tower', x: -21.5, z: 7.6 },
  { id: 'plante_galerie_1', type: 'plant', x: -6.8, z: 9.0 },
  { id: 'plante_galerie_2', type: 'plant', x: 6.8, z: 9.0 },
  { id: 'plante_cafe', type: 'plant', x: 9.0, z: -6.2 },
  { id: 'bin_galerie_1', type: 'public_bin', x: -6.9, z: 1.0 },
  { id: 'bin_galerie_2', type: 'public_bin', x: 6.9, z: 1.0 },
  { id: 'bin_parvis_1', type: 'public_bin', x: -6.0, z: -9.6 },
  { id: 'bin_parvis_2', type: 'public_bin', x: 6.0, z: -9.6 },
  { id: 'benne', type: 'wheelie_bin', x: 28.6, z: 10.5 },
  { id: 'bin_livraison', type: 'wheelie_bin', x: 28.8, z: 13.2 },
  { id: 'bin_cafe', type: 'kitchen_bin', x: 24.9, z: -6.3 },
  { id: 'pot_parvis_1', type: 'flowerpot', x: -2.4, z: -7.5 },
  { id: 'pot_parvis_2', type: 'flowerpot', x: 2.4, z: -7.5 },
  { id: 'pot_parvis_3', type: 'flowerpot', x: 15.5, z: -7.6 },
  { id: 'vase_buffet', type: 'vase', x: 0.6, z: -2.6, y: 0.78 },
  // Up high, for the cat.
  { id: 'tasse_1', type: 'mug', x: 12.1, z: -4.0, y: 0.75, rot: 0.4 },
  { id: 'tasse_2', type: 'mug', x: 16.1, z: 0.1, y: 0.75, rot: 1.4 },
  // Autumn.
  { id: 'feuilles_talus', type: 'leaf_pile', x: -28.0, z: 4.0, only: ['automne'] },
  { id: 'feuilles_parvis', type: 'leaf_pile', x: -21.5, z: -8.6, only: ['automne'] },
  { id: 'feuilles_parking', type: 'leaf_pile', x: 26.5, z: -15.6, only: ['automne'] },
  { id: 'feuilles_livraison', type: 'leaf_pile', x: 28.2, z: -2.0, only: ['automne'] },
  // Winter.
  { id: 'bonhomme_parvis', type: 'snowman', x: 19.5, z: -8.7, rot: 0.3, only: ['hiver'] },
  { id: 'bonhomme_talus', type: 'snowman', x: -28.0, z: 13.0, rot: -0.4, only: ['hiver'] },
];

const PUDDLES: Puddle[] = [
  // Fountain: wet paws all over the shops.
  { id: 'fontaine', x: 0, z: 4.5, r: 1.45, kind: 'water', hidden: true },
  { id: 'flaque_talus', x: -28.0, z: 7.0, r: 1.2 },
  { id: 'flaque_livraison', x: 28.2, z: 3.0, r: 1.2 },
];

const SPAWNS: { tofu: Spawn; humans: Spawn[] } = {
  tofu: { x: 23.4, z: 1.6, facing: -Math.PI * 0.6 },
  humans: [
    { x: -1, z: -1, facing: 0 },
    { x: 1, z: -1, facing: 0 },
  ],
};

const CAT_NODES: CatNode[] = [
  // Avenue & parking
  { id: 'rd_w', x: -12, z: -25, y: 0 },
  { id: 'rd_e', x: 12, z: -25, y: 0 },
  { id: 'sw_w', x: -12, z: -22, y: 0 },
  { id: 'sw_e', x: 12, z: -22, y: 0 },
  { id: 'pk_w', x: -27, z: -15.65, y: 0 },
  { id: 'pk_cw', x: -12, z: -15.65, y: 0 },
  { id: 'pk_c', x: 0, z: -15.65, y: 0 },
  { id: 'pk_ce', x: 12, z: -15.65, y: 0 },
  { id: 'pk_e', x: 27, z: -15.65, y: 0 },
  { id: 'car_r1', x: -7, z: -13, y: 1.5, perch: true },
  { id: 'car_r2', x: 15, z: -18.3, y: 1.5, perch: true },
  // Parvis, talus, delivery yard
  { id: 'pv_entry', x: 0, z: -8.6, y: 0 },
  { id: 'pv_w', x: -12, z: -8.6, y: 0 },
  { id: 'pv_e', x: 17, z: -8.6, y: 0 },
  { id: 'shelter_roof', x: -16, z: -8.6, y: 2.25, perch: true },
  { id: 'tw_n', x: -27.5, z: -6, y: 0 },
  { id: 'tw_m', x: -27.5, z: 10, y: 0 },
  { id: 'tw_s', x: -27.5, z: 15, y: 0 },
  { id: 't_tree', x: -29.3, z: 10, y: 2.6, perch: true },
  { id: 'te_n', x: 28.2, z: -6, y: 0 },
  { id: 'te_s', x: 28.2, z: 15.5, y: 0 },
  // Gallery
  { id: 'g_in', x: 0, z: -5.0, y: 0, indoor: true },
  { id: 'g_c', x: 0, z: 0.5, y: 0, indoor: true },
  { id: 'g_w', x: -3.6, z: 4.5, y: 0, indoor: true },
  { id: 'g_e', x: 3.6, z: 4.5, y: 0, indoor: true },
  { id: 'g_fountain', x: 0, z: 4.5, y: 1.2, perch: true, indoor: true },
  { id: 'g_s', x: 0, z: 10.5, y: 0, indoor: true },
  { id: 'g_ms', x: -5.5, z: -1, y: 0, indoor: true },
  { id: 'g_cs', x: 5.5, z: -1, y: 0, indoor: true },
  { id: 'g_js', x: -5.5, z: 9, y: 0, indoor: true },
  { id: 'g_ss', x: 5.5, z: 9, y: 0, indoor: true },
  // Shops
  { id: 'm_in', x: -10.5, z: -0.5, y: 0, indoor: true },
  { id: 'm_center', x: -17, z: -1.5, y: 0, indoor: true },
  { id: 'm_till', x: -11.5, z: 3.9, y: 0.95, perch: true, indoor: true },
  { id: 'j_in', x: -10.5, z: 9.0, y: 0, indoor: true },
  { id: 'j_center', x: -15, z: 13, y: 0, indoor: true },
  { id: 'j_shelf', x: -18, z: 11, y: 1.75, perch: true, indoor: true },
  { id: 'c_in', x: 10.5, z: -1.8, y: 0, indoor: true },
  { id: 'c_center', x: 18, z: -2, y: 0, indoor: true },
  { id: 'c_e', x: 23.5, z: -1.5, y: 0, indoor: true },
  { id: 'c_counter', x: 25.5, z: -1.0, y: 0.95, perch: true, indoor: true },
  { id: 's_in', x: 10.5, z: 9.0, y: 0, indoor: true },
  { id: 's_mid', x: 10.5, z: 11.5, y: 0, indoor: true },
  { id: 's_aisle', x: 18, z: 11.5, y: 0, indoor: true },
  { id: 's_shelf', x: 20.5, z: 13.5, y: 1.75, perch: true, indoor: true },
  { id: 's_e', x: 23.6, z: 11.5, y: 0, indoor: true },
  { id: 's_back', x: 24.5, z: 15.5, y: 0, indoor: true },
];

const CAT_EDGES: CatEdge[] = [
  { a: 'rd_w', b: 'rd_e' }, { a: 'rd_w', b: 'sw_w' }, { a: 'rd_e', b: 'sw_e' },
  { a: 'sw_w', b: 'pk_cw' }, { a: 'sw_e', b: 'pk_ce' },
  { a: 'pk_w', b: 'pk_cw' }, { a: 'pk_cw', b: 'pk_c' }, { a: 'pk_c', b: 'pk_ce' }, { a: 'pk_ce', b: 'pk_e' },
  { a: 'pk_cw', b: 'car_r1', jump: true }, { a: 'pk_ce', b: 'car_r2', jump: true },
  { a: 'pk_c', b: 'pv_entry' }, { a: 'pv_entry', b: 'pv_w' }, { a: 'pv_entry', b: 'pv_e' }, { a: 'pv_w', b: 'pk_cw' },
  { a: 'pv_w', b: 'shelter_roof', jump: true },
  { a: 'pk_w', b: 'tw_n' }, { a: 'tw_n', b: 'tw_m' }, { a: 'tw_m', b: 'tw_s' }, { a: 'tw_m', b: 't_tree', jump: true },
  { a: 'pk_e', b: 'te_n' }, { a: 'te_n', b: 'te_s' },
  // Indoors (the automatic doors are open)
  { a: 'pv_entry', b: 'g_in', door: 'entree' },
  { a: 'g_in', b: 'g_c' }, { a: 'g_c', b: 'g_w' }, { a: 'g_c', b: 'g_e' }, { a: 'g_w', b: 'g_s' }, { a: 'g_e', b: 'g_s' },
  { a: 'g_w', b: 'g_fountain', jump: true },
  { a: 'g_c', b: 'g_ms' }, { a: 'g_c', b: 'g_cs' }, { a: 'g_s', b: 'g_js' }, { a: 'g_s', b: 'g_ss' },
  { a: 'g_ms', b: 'm_in' }, { a: 'm_in', b: 'm_center' }, { a: 'm_in', b: 'm_till', jump: true },
  { a: 'g_js', b: 'j_in' }, { a: 'j_in', b: 'j_center' }, { a: 'j_center', b: 'j_shelf', jump: true },
  { a: 'g_cs', b: 'c_in' }, { a: 'c_in', b: 'c_center' }, { a: 'c_center', b: 'c_e' }, { a: 'c_e', b: 'c_counter', jump: true },
  { a: 'g_ss', b: 's_in' }, { a: 's_in', b: 's_mid' }, { a: 's_mid', b: 's_aisle' }, { a: 's_aisle', b: 's_shelf', jump: true },
  { a: 's_aisle', b: 's_e' }, { a: 's_e', b: 's_back' }, { a: 's_back', b: 'te_s', door: 'porte_livraison' },
];

export const CENTRE: MapDef = {
  id: 'centre',
  name: 'Le centre commercial',
  icon: '🛍️',
  desc: "L'inauguration des Galeries : boutiques, café, supermarché, parking et fontaine.",
  story: {
    prepare: "prépare l'inauguration",
    arriving: 'Le maire arrive',
    ding: "Fanfare ! Le maire arrive pour l'inauguration !",
    notReady: "Oh non ! Le centre commercial n'est plus prêt !",
    ready: "Tout est prêt : l'inauguration est un succès ! 🎉",
    late: "Le temps est écoulé et le centre commercial n'est pas prêt…",
    chaos: 'Trop de bêtises dans le centre commercial ! 😈',
    humans: "Le maire arrive pour l'inauguration. Finissez toutes les tâches et gardez le centre propre",
    listTitle: "À faire avant l'inauguration",
    cleanLabel: 'Centre propre',
    inside: 'dans les boutiques',
    tipStart: "Préparez le centre commercial avant l'arrivée du maire !",
    humanRole: "Prépare l'inauguration et surveille Tofu !",
  },
  bounds: BOUNDS,
  wallHeight: 2.7,
  zones: ZONES,
  streetZones: OUTSIDE,
  outsideZones: OUTSIDE,
  snowyZones: ['parvis', 'parking', 'talus', 'livraison', 'trottoir'],
  muddyZones: ['mode', 'jouets'],
  floors: FLOORS,
  walls: WALLS,
  buildings: [],
  doors: DOORS,
  props: PROPS,
  stations: STATIONS,
  items: ITEMS,
  puddles: PUDDLES,
  spawns: SPAWNS,
  catNodes: CAT_NODES,
  catEdges: CAT_EDGES,
  catStart: 'tw_m',
  variants: ['ete', 'automne', 'hiver'],
  tasks: {
    vetements: {
      title: 'Ranger les vêtements', icon: '👗',
      hint: 'Raccroche la robe, le jean, la marinière et le chapeau sur un portant de la boutique Mode. Le chapeau est tombé sur le parking !',
      spec: { type: 'collect', items: ['robe', 'jean', 'chapeau', 'mariniere'], kinds: ['clothes_rack'], dest: 'portant_1', destLabel: 'Portant' },
    },
    jouets: {
      title: 'Ranger le magasin de jouets', icon: '🧸',
      hint: 'Remets les 4 jouets sur le rayon du magasin de jouets.',
      spec: { type: 'collect', items: ['nounours', 'voiture', 'canard', 'dino'], kinds: ['shop_shelf'], dest: 'rayon_jouets', destLabel: 'Rayon des jouets' },
    },
    gateau: {
      title: 'Apporter le gâteau', icon: '🎂',
      hint: 'Pose le gâteau du café sur le buffet de la galerie. Si Tofu le mange, rachètes-en un à la pâtisserie !',
      spec: {
        type: 'deliver', item: 'gateau', dest: 'buffet', destLabel: 'Buffet', itemLabel: 'Gâteau',
        restock: { station: 'boulangerie', label: 'Pâtisserie', verb: 'Acheter un gâteau', thanks: 'Merci madame la pâtissière !' },
        keep: true,
      },
    },
    cartons: {
      title: 'Jeter les cartons', icon: '📦',
      hint: "Porte la pile de cartons de la réserve jusqu'à la benne, dans la cour de livraison.",
      spec: { type: 'deliver', item: 'cartons', dest: 'benne', destLabel: 'Benne', itemLabel: 'Cartons' },
    },
    caisse: {
      title: 'Installer le fond de caisse', icon: '💶',
      hint: 'Prends le fond de caisse sur le bureau de la réserve et installe-le à la caisse du supermarché.',
      spec: { type: 'deliver', item: 'fond_caisse', dest: 'caisse', destLabel: 'Caisse', itemLabel: 'Fond de caisse' },
    },
    jardinieres: {
      title: 'Arroser les jardinières', icon: '🌷',
      hint: "Prends l'arrosoir sur le parvis, remplis-le au robinet de la façade et arrose les deux jardinières de l'entrée.",
      spec: { type: 'water', beds: ['jardiniere_ouest', 'jardiniere_est'], can: 'arrosoir', tap: 'robinet', bedLabel: 'Jardinière', tapLabel: 'Robinet' },
    },
    ruban: {
      title: 'Tendre le ruban', icon: '🎀',
      hint: "Tends le ruban rouge à l'entrée de la galerie (maintiens le bouton). Tofu adore le mordiller !",
      spec: { type: 'make', station: 'ruban', label: 'Ruban' },
    },
  },
  secrets: [
    'voleur', 'tresor', 'rue', 'casse', 'boue_chambre', 'chat', 'poubelles', 'gourmand', 'innocent', 'zoomies',
    'creuse', 'aboie', 'facteur', 'papier', 'chaine', 'arrosoir',
  ],
  secretWording: {
    voleur: 'Vole 5 vêtements dans les boutiques',
    tresor: 'Cache 3 objets dans ton panier ou dans le coin des enfants',
    rue: 'Emporte un objet du centre commercial jusque sur le parking',
    boue_chambre: 'Laisse 12 traces de boue dans les boutiques Mode et Jouets',
    zoomies: 'Déclenche tes zoomies dans le centre commercial',
    creuse: 'Creuse un trou dans une jardinière',
    facteur: 'Aboie sur le vigile quand il passe',
    chaine: 'Fais renverser 2 objets par le chat ou par le robot de ménage',
    arrosoir: "Vole l'arrosoir et laisse 15 gouttes dans le centre commercial",
  },
  vacuum: { x: 0, z: 17.53, facing: Math.PI, name: 'le robot de ménage', color: 0xe67e22 },
  carrier: { z: -10.8, x0: -29.6, x1: 29.6, stopX: 0, name: 'le vigile', scared: 'Le vigile a sursauté !', look: 'guard' },
  ai: {
    indoorSpots: [
      [-17, -1, 'mode'], [-12, -5, 'mode'], [-14, 7.6, 'jouets'], [-20, 15.6, 'jouets'], [14, -2, 'cafe'], [21, 1.5, 'cafe'],
      [17.5, 11.5, 'superette'], [11, 15, 'superette'], [-3.6, 0, 'galerie'], [3.6, 9, 'galerie'], [-4.5, 15.2, 'toilettes'],
    ],
    escapes: [[-27.5, 5], [28.2, 0], [0, -15.6], [-12, -22], [12, -25], [-20, 12], [20, 11.5], [0, 10.5]],
    streetDrops: [[-12, -15.6], [12, -15.6], [0, -22], [-20, -25]],
    entrances: [[0, -7.9], [26.8, 15.5]],
    protectedDoors: { porte_toilettes: '*' },
  },
  roofs: [{ x0: -26, z0: -7, x1: 26, z1: 18, style: 'flat', color: 0x9aa3a8 }],
  road: { z0: -27.5, z1: -23, walks: [[-23, -21]], crossings: [] },
  decor: 'centre',
};
