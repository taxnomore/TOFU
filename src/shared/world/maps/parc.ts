// "Le parc": a birthday picnic in the town park.
//
// Coordinates are meters. x grows east, z grows south, y is up.
// The avenue runs north of the park railings (z = -19). Inside: the main
// path, the bandstand (kiosque), the picnic deck, the snack bar (buvette)
// with the public toilets, the playground, the paddling pool, the duck pond,
// the merry-go-round and the gardener's shed.
//
//      N (z-)   avenue du Parc (the family car)              <- z = -27.5
//               ======= railings, gate =======               <- z = -19
//   aire de jeux |  allée  |        buvette  WC
//      kiosque   |  (path) | pique-nique   nappe
//   ------------- allée des joggeurs ------------            <- z = 8.6
//   pataugeoire     manège             mare   cabane
//      S (z+)                                                <- z = 24

import type { MapDef } from '../mapTypes';
import type {
  CatEdge, CatNode, DoorDef, FloorPatch, ItemPlacement, PropDef, Puddle, Spawn, StationDef, WallDef, Zone,
} from '../types';

const BOUNDS = { x0: -32.5, z0: -27.5, x1: 32.5, z1: 24.5 };

const ZONES: Zone[] = [
  { id: 'buvette', name: 'la buvette', label: 'Buvette', indoor: true, x0: 18, z0: -17, x1: 26, z1: -11, floor: 'tomettes', wallColor: 0xf6e3b4 },
  { id: 'wc', name: 'les toilettes', label: 'Toilettes', indoor: true, x0: 26, z0: -17, x1: 31, z1: -11, floor: 'white_tiles', wallColor: 0xbde4dd },
  { id: 'cabane', name: 'la cabane du jardinier', label: 'Cabane du jardinier', indoor: true, x0: 24, z0: 17, x1: 30, z1: 23, floor: 'parquet', wallColor: 0xd9b48a },
  { id: 'kiosque', name: 'le kiosque', label: 'Kiosque à musique', indoor: false, x0: -15, z0: -5, x1: -9, z1: 1, prints: true, drips: true },
  { id: 'pique_nique', name: "l'aire de pique-nique", label: 'Pique-nique', indoor: false, x0: 2, z0: -6, x1: 14, z1: 4, prints: true, drips: true },
  { id: 'jeux', name: "l'aire de jeux", label: 'Aire de jeux', indoor: false, x0: -32, z0: -19, x1: -17, z1: -5 },
  { id: 'parc', name: 'le parc', label: 'Parc des Tilleuls', indoor: false, x0: -32, z0: -19, x1: 32, z1: 24.5 },
  { id: 'trottoir', name: 'le trottoir', label: 'Trottoir', indoor: false, x0: -32.5, z0: -22, x1: 32.5, z1: -19 },
  { id: 'rue', name: "l'avenue", label: 'Avenue du Parc', indoor: false, x0: -32.5, z0: -27.5, x1: 32.5, z1: -22 },
];

const OUTSIDE = ['rue', 'trottoir'];

const FLOORS: FloorPatch[] = [
  // Paths.
  { kind: 'gravel', x0: -1.5, z0: -19, x1: 1.5, z1: 8 },
  { kind: 'gravel', x0: -32, z0: 7.8, x1: 32, z1: 9.4 },
  { kind: 'gravel', x0: -9, z0: -3, x1: -1.5, z1: -1 },
  { kind: 'gravel', x0: 1.5, z0: -1.6, x1: 2, z1: -0.2 },
  { kind: 'gravel', x0: 20.3, z0: -11, x1: 21.7, z1: -7.8 },
  { kind: 'gravel', x0: 27.8, z0: -11, x1: 29.2, z1: -7.8 },
  { kind: 'gravel', x0: 14, z0: -8.6, x1: 30, z1: -7.8 },
  { kind: 'gravel', x0: 21.4, z0: 9.4, x1: 22.8, z1: 21 },
  { kind: 'gravel', x0: 22.8, z0: 19.4, x1: 24, z1: 20.6 },
  // Decks and buildings.
  { kind: 'parquet', x0: -15, z0: -5, x1: -9, z1: 1, y: 0.01 },
  { kind: 'parquet_light', x0: 2, z0: -6, x1: 14, z1: 4, y: 0.01, rot: 1 },
  { kind: 'tomettes', x0: 18, z0: -17, x1: 26, z1: -11 },
  { kind: 'white_tiles', x0: 26, z0: -17, x1: 31, z1: -11 },
  { kind: 'parquet', x0: 24, z0: 17, x1: 30, z1: 23 },
  // Playground.
  { kind: 'sand', x0: -29, z0: -17.5, x1: -18, z1: -12.5 },
  // Street.
  { kind: 'sidewalk', x0: -32.5, z0: -22, x1: 32.5, z1: -19 },
  { kind: 'asphalt', x0: -32.5, z0: -27.5, x1: 32.5, z1: -22 },
  { kind: 'crosswalk', x0: -1.6, z0: -27.3, x1: 1.6, z1: -22.2, y: 0.004 },
];

const WIN = (at: number, width = 1.2) => ({ at, width, kind: 'window' as const, sill: 0.9, top: 2.1 });

const WALLS: WallDef[] = [
  // --- Railings ---
  { id: 'f_north', x0: -32.2, z0: -19, x1: 32.2, z1: -19, style: 'fence', height: 1.6, openings: [
    { at: 10.2, width: 2.0, kind: 'gate', door: 'portillon' },
    { at: 32.2, width: 3.2, kind: 'gate', door: 'portail' },
    { at: 48.2, width: 0.9, kind: 'doghole' },
  ] },
  { id: 'h_west', x0: -32.2, z0: -19, x1: -32.2, z1: 24.2, style: 'hedge' },
  { id: 'h_east', x0: 32.2, z0: -19, x1: 32.2, z1: 24.2, style: 'hedge' },
  { id: 'h_south', x0: -32.2, z0: 24.2, x1: 32.2, z1: 24.2, style: 'hedge' },
  { id: 'e_west', x0: -32.8, z0: -27.5, x1: -32.8, z1: -19, style: 'hedge', height: 2.4 },
  { id: 'e_east', x0: 32.8, z0: -27.5, x1: 32.8, z1: -19, style: 'hedge', height: 2.4 },
  // --- Buvette and toilets ---
  { id: 'bv_n', x0: 18, z0: -17, x1: 26, z1: -17, style: 'house_ext', color: 0xf6e3b4, shutter: 0x27ae60, openings: [WIN(4)] },
  { id: 'bv_s', x0: 18, z0: -11, x1: 26, z1: -11, style: 'house_ext', color: 0xf6e3b4, shutter: 0x27ae60, openings: [
    { at: 3, width: 1.2, kind: 'door', door: 'porte_buvette' },
    { at: 6, width: 2.0, kind: 'window', sill: 0.95, top: 1.95, open: true },
  ] },
  { id: 'bv_w', x0: 18, z0: -17, x1: 18, z1: -11, style: 'house_ext', color: 0xf6e3b4, shutter: 0x27ae60, openings: [WIN(3)] },
  { id: 'bv_wc', x0: 26, z0: -17, x1: 26, z1: -11, style: 'house_int' },
  { id: 'wc_n', x0: 26, z0: -17, x1: 31, z1: -17, style: 'house_ext', color: 0xe3e0d3, shutter: -1 },
  { id: 'wc_s', x0: 26, z0: -11, x1: 31, z1: -11, style: 'house_ext', color: 0xe3e0d3, shutter: -1, openings: [
    { at: 2.5, width: 1.2, kind: 'door', door: 'porte_wc' },
  ] },
  { id: 'wc_e', x0: 31, z0: -17, x1: 31, z1: -11, style: 'house_ext', color: 0xe3e0d3, shutter: -1, openings: [{ at: 3, width: 0.8, kind: 'window', sill: 1.5, top: 2.1 }] },
  // --- Gardener's shed ---
  { id: 'cb_n', x0: 24, z0: 17, x1: 30, z1: 17, style: 'house_ext', color: 0x9a7650, shutter: -1, openings: [WIN(3, 1.0)] },
  { id: 'cb_s', x0: 24, z0: 23, x1: 30, z1: 23, style: 'house_ext', color: 0x9a7650, shutter: -1 },
  { id: 'cb_w', x0: 24, z0: 17, x1: 24, z1: 23, style: 'house_ext', color: 0x9a7650, shutter: -1, openings: [
    { at: 3, width: 1.2, kind: 'door', door: 'porte_cabane' },
  ] },
  { id: 'cb_e', x0: 30, z0: 17, x1: 30, z1: 23, style: 'house_ext', color: 0x9a7650, shutter: -1 },
];

const DOORS: DoorDef[] = [
  { id: 'portail', name: 'le portail du parc', kind: 'gate', x: 0, z: -19, axis: 'x', width: 3.2, hinge: -1, swing: 1, dogCanPush: false, dogFlap: false, open: true, color: 0x2f5d50 },
  { id: 'portillon', name: "le portillon de l'aire de jeux", kind: 'gate', x: -22, z: -19, axis: 'x', width: 2.0, hinge: -1, swing: 1, dogCanPush: false, dogFlap: false, open: false, color: 0x2f5d50 },
  { id: 'porte_buvette', name: 'la porte de la buvette', kind: 'exterior', x: 21, z: -11, axis: 'x', width: 1.2, hinge: -1, swing: -1, dogCanPush: false, dogFlap: false, open: true, color: 0x27ae60 },
  { id: 'porte_wc', name: 'la porte des toilettes', kind: 'exterior', x: 28.5, z: -11, axis: 'x', width: 1.2, hinge: 1, swing: -1, dogCanPush: false, dogFlap: false, open: true, color: 0x7f8c8d },
  { id: 'porte_cabane', name: 'la porte de la cabane', kind: 'exterior', x: 24, z: 20, axis: 'z', width: 1.2, hinge: -1, swing: 1, dogCanPush: true, dogFlap: false, open: false, color: 0x6d4c33 },
];

const PROPS: PropDef[] = [
  // --- Avenue ---
  { type: 'car', x: -4.6, z: -24.0, rot: 1, color: 0x3d6fa8, v: 1 },
  { type: 'car', x: 12, z: -26.6, rot: 3, color: 0xf2c94c, v: 2 },
  { type: 'car', x: -22, z: -26.6, rot: 3, color: 0xd2483a },
  { type: 'plane_tree', x: -26, z: -21.4 },
  { type: 'plane_tree', x: -12, z: -21.4 },
  { type: 'plane_tree', x: 12, z: -21.4 },
  { type: 'plane_tree', x: 26, z: -21.4 },
  { type: 'streetlamp', x: -5, z: -21.4 },
  { type: 'streetlamp', x: 5, z: -21.4 },
  // --- Kiosque ---
  { type: 'pillar', x: -14.8, z: -4.8 },
  { type: 'pillar', x: -9.2, z: -4.8 },
  { type: 'pillar', x: -14.8, z: 0.8 },
  { type: 'pillar', x: -9.2, z: 0.8 },
  { type: 'flowerbed', x: -12, z: 4.5, w: 4.0, d: 1.2 },
  // --- Main path ---
  { type: 'drinking_fountain', x: 3, z: -10 },
  { type: 'bench', x: -2.6, z: -12, rot: 1 },
  { type: 'bench', x: 2.6, z: -13.6, rot: 3 },
  { type: 'streetlamp', x: -2.4, z: -16 },
  { type: 'streetlamp', x: 2.4, z: -4.6 },
  { type: 'flowerbed', x: 0, z: 4.5, w: 3.0, d: 3.0 },
  // --- Pique-nique ---
  { type: 'picnic_table', x: 5, z: -3 },
  { type: 'trestle_table', x: 10, z: -3 },
  { type: 'picnic_table', x: 5, z: 1.5 },
  { type: 'picnic_table', x: 10, z: 1.5 },
  { type: 'cooler', x: 12.8, z: -5.2 },
  { type: 'parasol', x: 7.5, z: -0.7 },
  { type: 'dog_basket', x: 3.0, z: 3.2 },
  { type: 'clothesline_basket', x: 3.2, z: -5.3 },
  // --- Buvette & toilettes ---
  { type: 'counter', x: 24, z: -11.45, w: 2.4, rot: 2 },
  { type: 'counter', x: 21, z: -16.55, w: 3.0, rot: 0 },
  { type: 'fridge', x: 25.4, z: -16.5, rot: 0 },
  { type: 'cafe_table', x: 20, z: -9 },
  { type: 'garden_chair', x: 19.25, z: -9, rot: 1, color: 0x27ae60 },
  { type: 'garden_chair', x: 20.75, z: -9, rot: 3, color: 0x27ae60 },
  { type: 'cafe_table', x: 24, z: -9 },
  { type: 'garden_chair', x: 23.25, z: -9, rot: 1, color: 0x27ae60 },
  { type: 'garden_chair', x: 24.75, z: -9, rot: 3, color: 0x27ae60 },
  { type: 'awning', x: 24, z: -10.2, w: 3.0, d: 1.4 },
  { type: 'toilet', x: 27.3, z: -16.52, rot: 0 },
  { type: 'toilet', x: 29.7, z: -16.52, rot: 0 },
  { type: 'vanity', x: 30.6, z: -13, rot: 3 },
  { type: 'roll_holder', x: 28.5, z: -16.79, rot: 0 },
  // --- Playground ---
  { type: 'swing_set', x: -26, z: -15.5 },
  { type: 'slide', x: -20.5, z: -15.5 },
  { type: 'sandbox', x: -25, z: -9, w: 3, d: 3 },
  { type: 'spring_rider', x: -20, z: -8.5 },
  { type: 'spring_rider', x: -22, z: -7.0, v: 1 },
  { type: 'bench', x: -18.4, z: -12, rot: 3 },
  // --- South lawn ---
  { type: 'pool', x: -20, z: 13 },
  { type: 'pond', x: 20, z: 15 },
  { type: 'carousel', x: -4, z: 16 },
  { type: 'bench', x: -16.5, z: 17.2, rot: 2 },
  { type: 'bench', x: 15.6, z: 18.6, rot: 1 },
  { type: 'streetlamp', x: -17, z: 7.4 },
  { type: 'streetlamp', x: 17, z: 7.4 },
  // --- Shed ---
  { type: 'counter', x: 27, z: 22.55, w: 3.0, rot: 2 },
  { type: 'dog_basket', x: 28.6, z: 18.4 },
  { type: 'vacuum_dock', x: 22.6, z: 22.0, rot: 0 },
  // --- Trees and bushes ---
  { type: 'tree', x: -28, z: 4 },
  { type: 'tree', x: -8, z: -14, v: 1 },
  { type: 'tree', x: 8, z: -14, v: 2 },
  { type: 'tree', x: 27, z: 2 },
  { type: 'tree', x: -26, z: 20, v: 1 },
  { type: 'tree', x: 9, z: 19.5, v: 2 },
  { type: 'tree', x: -13.5, z: 20.5 },
  { type: 'fruit_tree', x: 14, z: -15, v: 1 },
  { type: 'bush', x: -30.8, z: -2.0 },
  { type: 'bush', x: -30.6, z: 11.0, v: 1 },
  { type: 'bush', x: 30.8, z: 8.0 },
  { type: 'bush', x: 3.5, z: 22.8, v: 1 },
  { type: 'bush', x: -9.0, z: -18.3 },
  { type: 'bush', x: 9.0, z: -18.3, v: 1 },
];

const BASKET_SLOTS: [number, number, number][] = [[-0.2, 0.15, -0.1], [0.2, 0.15, 0.1], [0.0, 0.18, 0.25], [-0.25, 0.2, 0.25], [0.25, 0.2, -0.2]];

const STATIONS: StationDef[] = [
  { id: 'coffre', kind: 'cupboard', name: 'le coffre de la voiture', x: -6.95, z: -24.0, y: 0.75, r: 1.0, hw: 0.2, hd: 0.8, dogReach: false, capacity: 3 },
  { id: 'table_cadeaux', kind: 'gift_table', name: 'la table des cadeaux', x: 10, z: -3, y: 0.78, r: 1.0, hw: 1.0, hd: 0.4, dogReach: false, capacity: 3,
    slots: [[-0.6, 0.78, 0], [0, 0.78, 0], [0.6, 0.78, 0]] },
  { id: 'table_gateau', kind: 'garden_table', name: 'la table du pique-nique', x: 5, z: -3, y: 0.76, r: 1.0, hw: 0.9, hd: 0.35, dogReach: true, capacity: 2 },
  { id: 'glaciere', kind: 'counter', name: 'la glacière', x: 12.8, z: -5.2, y: 0.48, r: 0.9, hw: 0.3, hd: 0.2, dogReach: true, capacity: 2 },
  { id: 'sac_jouets', kind: 'toybox', name: 'le sac de plage', x: 3.2, z: -5.3, y: 0.35, r: 0.9, dogReach: false, capacity: 6 },
  { id: 'nappe', kind: 'bed', name: 'la nappe', x: 18, z: -2.0, y: 0.03, r: 0.8, hw: 1.6, hd: 1.2,
    make: {
      verb: 'Étendre la nappe', jump: 'Se rouler sur la nappe', undone: 'Nappe en boule !', look: 'blanket', mess: 'muddy_blanket',
      dirty: ['Une nappe pleine de boue !', 'Une nappe toute mouillée !', 'Des feuilles sur la nappe !'],
    } },
  { id: 'ballons', kind: 'bed', name: 'les ballons', x: 13.3, z: 3.3, y: 0.8, r: 0.9, hw: 0.4, hd: 0.4,
    make: { verb: 'Gonfler les ballons', jump: 'Faire éclater les ballons', undone: 'Pop ! Ballons éclatés !', look: 'balloons' } },
  { id: 'boulangerie', kind: 'bakery', name: 'la buvette', x: 24, z: -11.45, y: 0.95, r: 1.0, hw: 1.1, hd: 0.3, dogReach: true, capacity: 3,
    slots: [[-0.7, 0.95, 0], [0.0, 0.95, 0], [0.7, 0.95, 0]] },
  { id: 'cuisine_buvette', kind: 'counter', name: 'la cuisine de la buvette', x: 21.6, z: -16.55, y: 0.92, r: 0.95, hw: 0.8, hd: 0.3, dogReach: true, capacity: 2 },
  { id: 'bocal', kind: 'treat_jar', name: 'le bocal de friandises', x: 19.8, z: -16.55, y: 0.92, r: 0.95, hw: 0.3, hd: 0.3 },
  { id: 'poubelle_parc', kind: 'street_bin', name: 'la grande poubelle', x: 3.6, z: -17.8, y: 1.0, r: 1.5, dogReach: false, linkedItem: 'bin_parc', capacity: 2 },
  { id: 'massif_rond', kind: 'flowerbed', name: 'le massif rond', x: 0, z: 4.5, y: 0.2, r: 0.9, hw: 1.5, hd: 1.5 },
  { id: 'massif_kiosque', kind: 'flowerbed', name: 'le massif du kiosque', x: -12, z: 4.5, y: 0.2, r: 0.9, hw: 2.0, hd: 0.6 },
  { id: 'fontaine_eau', kind: 'tap', name: 'la fontaine', x: 3, z: -10, y: 0.9, r: 1.0 },
  { id: 'derouleur', kind: 'roll_holder', name: 'le dérouleur de papier', x: 28.5, z: -16.71, y: 0.56, r: 0.8, dogReach: true, capacity: 1 },
  { id: 'panier_tofu', kind: 'dog_basket', name: 'le panier de Tofu', x: 3.0, z: 3.2, y: 0.12, r: 0.95, capacity: 20, slots: BASKET_SLOTS },
  { id: 'panier_cabane', kind: 'dog_basket', name: 'le vieux panier de la cabane', x: 28.6, z: 18.4, y: 0.12, r: 0.95, capacity: 20, slots: BASKET_SLOTS },
];

const ITEMS: ItemPlacement[] = [
  // Presents in the car, the cake at the snack bar.
  { id: 'cadeau_1', type: 'gift', station: 'coffre' },
  { id: 'cadeau_2', type: 'gift', station: 'coffre' },
  { id: 'cadeau_3', type: 'gift', station: 'coffre' },
  { id: 'gateau', type: 'cake', station: 'cuisine_buvette' },
  { id: 'croissants', type: 'croissants', station: 'glaciere' },
  { id: 'baguette', type: 'baguette', station: 'boulangerie' },
  // Beach toys all over the park.
  { id: 'seau_plage', type: 'sand_bucket', x: -24.6, z: -9.4 },
  { id: 'pelle', type: 'shovel', x: -20.8, z: -11.2, rot: 0.8 },
  { id: 'ballon_plage', type: 'beach_ball', x: -17.0, z: 10.6 },
  { id: 'frisbee', type: 'frisbee', x: -6.0, z: 5.4 },
  // Things of the family (laundry for Tofu).
  { id: 'serviette_1', type: 'towel', x: -16.8, z: 10.6, rot: 0.4 },
  { id: 'serviette_2', type: 'towel', x: -23.2, z: 16.2, rot: -0.6 },
  { id: 'chaussette', type: 'sock', x: -22.6, z: 10.2, rot: 1.2 },
  { id: 'casquette', type: 'cap', x: -0.8, z: 12.4 },
  { id: 'mariniere', type: 'tshirt', x: 6.6, z: -0.6, rot: 0.6 },
  // Job objects.
  { id: 'sac_poubelle', type: 'trash_bag', x: 11.6, z: -5.6, rot: 0.3 },
  { id: 'arrosoir', type: 'watering_can', x: 4.6, z: -9.2, rot: -1.2 },
  { id: 'papier_toilette', type: 'toilet_roll', station: 'derouleur' },
  { id: 'balle', type: 'ball', x: -4, z: -6 },
  // Knockables.
  { id: 'citronnade', type: 'lemonade', x: 5.3, z: 1.5, y: 0.76 },
  { id: 'vase_cadeaux', type: 'vase', x: 10.75, z: -3.2, y: 0.78 },
  { id: 'bin_parc', type: 'wheelie_bin', x: 3.6, z: -17.8 },
  { id: 'bin_buvette', type: 'wheelie_bin', x: 18.6, z: -10.5 },
  { id: 'bin_1', type: 'public_bin', x: -3, z: -14 },
  { id: 'bin_2', type: 'public_bin', x: 2.4, z: 6.9 },
  { id: 'bin_3', type: 'public_bin', x: 15, z: -8.2 },
  { id: 'pot_buvette_1', type: 'flowerpot', x: 19.2, z: -10.5 },
  { id: 'pot_buvette_2', type: 'flowerpot', x: 25.6, z: -10.5 },
  { id: 'pot_kiosque_2', type: 'flowerpot', x: -8.6, z: 1.4 },
  { id: 'plante_buvette', type: 'plant', x: 18.6, z: -12.0 },
  { id: 'seau', type: 'watering_pot', x: -17.4, z: 15.6 },
  { id: 'nain', type: 'gnome', x: 22.8, z: 17.6 },
  { id: 'tour_sable', type: 'toy_tower', x: -23.6, z: -8.2 },
  // Autumn.
  { id: 'feuilles_1', type: 'leaf_pile', x: -6.0, z: -8.0, only: ['automne'] },
  { id: 'feuilles_2', type: 'leaf_pile', x: 16.5, z: 4.5, only: ['automne'] },
  { id: 'feuilles_3', type: 'leaf_pile', x: -24.0, z: 2.0, only: ['automne'] },
  { id: 'feuilles_4', type: 'leaf_pile', x: 6.0, z: 13.5, only: ['automne'] },
  { id: 'feuilles_5', type: 'leaf_pile', x: 26.0, z: -4.0, only: ['automne'] },
  // Winter.
  { id: 'bonhomme_1', type: 'snowman', x: -6.0, z: -9.0, rot: 0.3, only: ['hiver'] },
  { id: 'bonhomme_2', type: 'snowman', x: 16.6, z: 5.0, rot: -0.4, only: ['hiver'] },
  { id: 'bonhomme_3', type: 'snowman', x: -22.0, z: 3.0, rot: 0.8, only: ['hiver'] },
];

const PUDDLES: Puddle[] = [
  { id: 'pataugeoire', x: -20, z: 13, r: 2.1, kind: 'water', hidden: true },
  { id: 'flaque_mare', x: 15.6, z: 11.6, r: 1.25 },
  { id: 'flaque_jeux', x: -14.5, z: -11, r: 1.2 },
];

const SPAWNS: { tofu: Spawn; humans: Spawn[] } = {
  tofu: { x: 3.6, z: 1.8, facing: Math.PI * 0.75 },
  humans: [
    { x: -1, z: -16.5, facing: 0 },
    { x: 1, z: -16.5, facing: 0 },
  ],
};

const CAT_NODES: CatNode[] = [
  // Avenue
  { id: 'rd_w', x: -20, z: -25.3, y: 0 },
  { id: 'rd_e', x: 20, z: -25.3, y: 0 },
  { id: 'st_w', x: -20, z: -20.2, y: 0 },
  { id: 'st_gate', x: 0, z: -20.2, y: 0 },
  { id: 'st_e', x: 16, z: -20.2, y: 0 },
  { id: 'st_far_e', x: 26, z: -20.2, y: 0 },
  { id: 'car_roof', x: -4.6, z: -24.0, y: 1.5, perch: true },
  // Park
  { id: 'p_gate', x: 0, z: -17.4, y: 0 },
  { id: 'p_hole', x: 16, z: -17.4, y: 0 },
  { id: 'p_allee', x: 0, z: -9, y: 0 },
  { id: 'p_tree_n', x: 6.8, z: -12.5, y: 0 },
  { id: 't_n', x: 8, z: -14, y: 3.0, perch: true },
  { id: 'p_center', x: 0, z: -2.5, y: 0 },
  { id: 'p_kiosk_e', x: -8, z: -2, y: 0 },
  { id: 'p_kiosk', x: -12, z: -2, y: 0 },
  { id: 'kiosk_roof', x: -12, z: -2, y: 3.4, perch: true },
  { id: 'p_kiosk_w', x: -16, z: -2, y: 0 },
  { id: 'p_jeux', x: -22, z: -10.5, y: 0 },
  { id: 'slide_top', x: -20.5, z: -16.2, y: 1.5, perch: true },
  { id: 'p_west', x: -27, z: 2, y: 0 },
  { id: 't_w', x: -28, z: 4, y: 3.0, perch: true },
  { id: 'p_pool', x: -16.5, z: 12.6, y: 0 },
  { id: 'p_south', x: 0, z: 13, y: 0 },
  { id: 'p_deck', x: 6.5, z: -0.8, y: 0 },
  { id: 'p_deck_e', x: 15.5, z: -0.8, y: 0 },
  { id: 'p_buv', x: 21, z: -9.4, y: 0 },
  { id: 'buv_roof', x: 22, z: -14, y: 3.4, perch: true },
  { id: 'b_in', x: 21, z: -13.5, y: 0 },
  { id: 'b_counter', x: 24, z: -11.5, y: 0.95, perch: true },
  { id: 'p_pond_n', x: 20, z: 10.2, y: 0 },
  { id: 'p_pond_e', x: 25.5, z: 13, y: 0 },
  { id: 'p_gap', x: 23.5, z: 16.4, y: 0 },
  { id: 'p_cab', x: 22.5, z: 19.6, y: 0 },
  { id: 'c_in', x: 25.5, z: 20, y: 0 },
  { id: 'c_roof', x: 27, z: 20, y: 3.2, perch: true },
];

const CAT_EDGES: CatEdge[] = [
  { a: 'rd_w', b: 'rd_e' }, { a: 'st_w', b: 'rd_w' }, { a: 'st_e', b: 'rd_e' },
  { a: 'st_w', b: 'st_gate' }, { a: 'st_gate', b: 'st_e' }, { a: 'st_e', b: 'st_far_e' },
  { a: 'rd_w', b: 'car_roof', jump: true },
  { a: 'st_gate', b: 'p_gate', door: 'portail' }, { a: 'st_e', b: 'p_hole' }, { a: 'p_hole', b: 'p_gate' },
  { a: 'p_gate', b: 'p_allee' }, { a: 'p_allee', b: 'p_center' }, { a: 'p_allee', b: 'p_tree_n' }, { a: 'p_tree_n', b: 't_n', jump: true },
  { a: 'p_center', b: 'p_kiosk_e' }, { a: 'p_kiosk_e', b: 'p_kiosk' }, { a: 'p_kiosk', b: 'p_kiosk_w' },
  { a: 'p_kiosk_e', b: 'kiosk_roof', jump: true },
  { a: 'p_kiosk_w', b: 'p_jeux' }, { a: 'p_jeux', b: 'slide_top', jump: true },
  { a: 'p_kiosk_w', b: 'p_west' }, { a: 'p_west', b: 't_w', jump: true }, { a: 'p_west', b: 'p_pool' },
  { a: 'p_pool', b: 'p_south' }, { a: 'p_center', b: 'p_south' },
  { a: 'p_center', b: 'p_deck' }, { a: 'p_deck', b: 'p_deck_e' }, { a: 'p_deck_e', b: 'p_buv' },
  { a: 'p_buv', b: 'b_in', door: 'porte_buvette' }, { a: 'b_in', b: 'b_counter', jump: true }, { a: 'p_buv', b: 'buv_roof', jump: true },
  { a: 'p_deck_e', b: 'p_pond_n' }, { a: 'p_pond_n', b: 'p_pond_e' }, { a: 'p_pond_e', b: 'p_gap' }, { a: 'p_gap', b: 'p_cab' },
  { a: 'p_cab', b: 'c_in', door: 'porte_cabane' }, { a: 'p_cab', b: 'c_roof', jump: true },
];

export const PARC: MapDef = {
  id: 'parc',
  name: 'Le parc',
  icon: '🌳',
  desc: "Un pique-nique d'anniversaire au parc : kiosque, aire de jeux, pataugeoire, mare et buvette.",
  story: {
    prepare: 'prépare le pique-nique',
    arriving: 'Les copains arrivent',
    ding: "Youpi ! Les copains arrivent pour l'anniversaire !",
    notReady: "Oh non ! Le pique-nique n'est plus prêt !",
    ready: 'Le pique-nique est prêt : joyeux anniversaire ! 🎉',
    late: "Le temps est écoulé et le pique-nique n'est pas prêt…",
    chaos: 'Trop de bêtises dans le parc ! 😈',
    humans: "Les copains arrivent pour l'anniversaire. Finissez toutes les tâches et gardez le pique-nique propre",
    listTitle: "À faire avant l'anniversaire",
    cleanLabel: 'Pique-nique propre',
    inside: 'sur le pique-nique',
    tipStart: "Préparez le pique-nique avant l'arrivée des copains !",
    humanRole: "Prépare l'anniversaire et surveille Tofu !",
  },
  bounds: BOUNDS,
  wallHeight: 2.7,
  zones: ZONES,
  streetZones: OUTSIDE,
  outsideZones: OUTSIDE,
  snowyZones: ['parc', 'jeux'],
  muddyZones: ['pique_nique', 'kiosque'],
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
  catStart: 'p_south',
  variants: ['ete', 'automne', 'hiver'],
  tasks: {
    cadeaux: {
      title: 'Apporter les cadeaux', icon: '🎁',
      hint: "Les cadeaux sont dans le coffre de la voiture, garée dans l'avenue. Pose-les sur la table des cadeaux du pique-nique.",
      spec: { type: 'collect', items: ['cadeau_1', 'cadeau_2', 'cadeau_3'], kinds: ['gift_table'], dest: 'table_cadeaux', destLabel: 'Table des cadeaux' },
    },
    gateau: {
      title: 'Apporter le gâteau', icon: '🎂',
      hint: 'Le gâteau attend au frais dans la cuisine de la buvette. Pose-le sur la table du pique-nique. Si Tofu le mange, rachètes-en un à la buvette !',
      spec: {
        type: 'deliver', item: 'gateau', dest: 'table_gateau', destLabel: 'Table du pique-nique', itemLabel: 'Gâteau',
        restock: { station: 'boulangerie', label: 'Buvette', verb: 'Acheter un gâteau', thanks: 'Merci, et bonne fête !' },
        keep: true,
      },
    },
    nappe: {
      title: 'Étendre la nappe', icon: '🧺',
      hint: 'Étends la grande nappe sur la pelouse, à côté du pique-nique (maintiens le bouton).',
      spec: { type: 'make', station: 'nappe', label: 'Nappe' },
    },
    jouets: {
      title: 'Ramasser les jouets', icon: '🏖️',
      hint: 'Ramasse le seau, la pelle et le ballon de plage, et range-les dans le sac de plage, près du pique-nique.',
      spec: { type: 'collect', items: ['seau_plage', 'pelle', 'ballon_plage'], kinds: ['toybox'], dest: 'sac_jouets', destLabel: 'Sac de plage' },
    },
    poubelle: {
      title: 'Jeter les déchets', icon: '🗑️',
      hint: "Jette le sac poubelle du pique-nique dans la grande poubelle, près de l'entrée du parc.",
      spec: { type: 'deliver', item: 'sac_poubelle', dest: 'poubelle_parc', destLabel: 'Grande poubelle', itemLabel: 'Sac poubelle' },
    },
    ballons: {
      title: 'Gonfler les ballons', icon: '🎈',
      hint: 'Gonfle les ballons et attache-les au coin du pique-nique (maintiens le bouton).',
      spec: { type: 'make', station: 'ballons', label: 'Ballons' },
    },
    fleurs: {
      title: 'Arroser les massifs', icon: '🌷',
      hint: "Prends l'arrosoir près de la fontaine, remplis-le et arrose les deux massifs.",
      spec: { type: 'water', beds: ['massif_rond', 'massif_kiosque'], can: 'arrosoir', tap: 'fontaine_eau', bedLabel: 'Massif', tapLabel: 'Fontaine' },
    },
  },
  secrets: [
    'voleur', 'tresor', 'rue', 'casse', 'boue_chambre', 'chat', 'poubelles', 'gourmand', 'innocent', 'zoomies', 'lit_sale',
    'creuse', 'aboie', 'facteur', 'papier', 'chaine', 'arrosoir',
  ],
  secretWording: {
    voleur: 'Vole 5 affaires (serviettes, casquette, chaussette…)',
    tresor: 'Cache 3 objets dans ton panier ou dans la cabane',
    rue: 'Emporte un objet du parc jusque dans la rue',
    boue_chambre: 'Laisse 12 traces de boue sur le pique-nique et le kiosque',
    zoomies: 'Déclenche tes zoomies sur le pique-nique ou le kiosque',
    lit_sale: 'Roule-toi sur la nappe avec les pattes pleines de boue',
    creuse: 'Creuse un trou dans un massif de fleurs',
    facteur: 'Aboie sur la joggeuse quand elle passe',
    chaine: 'Fais renverser 2 objets par le chat ou par la tondeuse robot',
    arrosoir: "Vole l'arrosoir et laisse 15 gouttes sur le pique-nique",
  },
  vacuum: { x: 22.6, z: 22.25, facing: Math.PI, name: 'la tondeuse robot', color: 0x27ae60 },
  carrier: { z: 8.6, x0: -31.5, x1: 31.5, stopX: 0, name: 'la joggeuse', scared: 'La joggeuse a sursauté !', look: 'jogger', speed: 2.8 },
  ai: {
    indoorSpots: [
      [6.5, -0.8, 'pique_nique'], [11, -0.8, 'pique_nique'], [4, -4.6, 'pique_nique'], [12.6, 2.6, 'pique_nique'],
      [-12, -2, 'kiosque'], [-11, 0, 'kiosque'], [21, -14, 'buvette'], [28.5, -13, 'wc'], [26.5, 20, 'cabane'],
    ],
    escapes: [[-27, 2], [0, 13], [26, 4], [-22, -10.5], [20, -20.2], [-16.5, 12.6], [15.5, -0.8], [0, -20.2]],
    streetDrops: [[-10, -25.3], [10, -25.3], [0, -20.2], [-20, -20.2]],
    entrances: [[21, -10.4], [1.6, -0.9], [-8.4, -2]],
    protectedDoors: { porte_wc: '*' },
  },
  roofs: [
    { x0: -15, z0: -5, x1: -9, z1: 1, style: 'hip', color: 0x2f5d50, y: 2.9 },
    { x0: 18, z0: -17, x1: 31, z1: -11, style: 'gable', color: 0xc0392b },
    { x0: 24, z0: 17, x1: 30, z1: 23, style: 'gable', color: 0x6d4c33 },
  ],
  road: { z0: -27.5, z1: -22, walks: [[-22, -19]], crossings: [[-1.6, 1.6]] },
  decor: 'parc',
  // Two computer humans clear this place faster than the house: a lower goal keeps the game even.
  chaosGoals: [250, 120, 160],
};
