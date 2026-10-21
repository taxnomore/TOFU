// "L'école": the primary school on the day of the school party.
//
// Coordinates are meters. x grows east, z grows south, y is up.
// The street runs east-west at z in [-23,-16]. The school sits south of it,
// behind railings: the playground (cour) and its covered area (préau), then
// the building with its corridor, the classroom, the library, the canteen
// and the toilets. The vegetable garden (potager) lies east.
//
//      N (z-)   buildings + boulangerie                 <- z = -27.5
//               ===== rue de l'École =====
//               trottoir (railings at z = -13)
//   préau |        cour          | potager
//         |                      |
//   ===== couloir ===============|               <- z = -2 .. 1.5
//   classe | biblio | cantine | WC|
//      S (z+)                                         <- z = 12

import type { MapDef } from '../mapTypes';
import type {
  BuildingDef, CatEdge, CatNode, DoorDef, FloorPatch, ItemPlacement, PropDef, Puddle, Spawn, StationDef,
  WallDef, Zone,
} from '../types';

const BOUNDS = { x0: -30.5, z0: -27.5, x1: 30.5, z1: 12.5 };

const ZONES: Zone[] = [
  { id: 'classe', name: 'la classe', label: 'Classe', indoor: true, x0: -28.5, z0: 1.5, x1: -16, z1: 12, floor: 'parquet', wallColor: 0xf6e3b4 },
  { id: 'bibliotheque', name: 'la bibliothèque', label: 'Bibliothèque', indoor: true, x0: -16, z0: 1.5, x1: -7, z1: 12, floor: 'carpet', wallColor: 0xcfe3c4 },
  { id: 'cantine', name: 'la cantine', label: 'Cantine', indoor: true, x0: -7, z0: 1.5, x1: 4, z1: 12, floor: 'white_tiles', wallColor: 0xf5d5c8 },
  { id: 'toilettes', name: 'les toilettes', label: 'Toilettes', indoor: true, x0: 4, z0: 1.5, x1: 10, z1: 12, floor: 'white_tiles', wallColor: 0xbde4dd },
  { id: 'couloir', name: 'le couloir', label: 'Couloir', indoor: true, x0: -28.5, z0: -2, x1: 10, z1: 1.5, floor: 'cement_tiles', wallColor: 0xe9e1d0 },
  { id: 'preau', name: 'le préau', label: 'Préau', indoor: false, x0: -28.5, z0: -13, x1: -18, z1: -2, drips: true, prints: true },
  { id: 'cour', name: 'la cour', label: 'Cour de récréation', indoor: false, x0: -18, z0: -13, x1: 10, z1: -2 },
  { id: 'potager', name: 'le potager', label: 'Potager', indoor: false, x0: 10, z0: -13, x1: 28.5, z1: 12 },
  { id: 'boulangerie', name: 'devant la boulangerie', label: 'Boulangerie', indoor: false, x0: -8.5, z0: -27.5, x1: 6.5, z1: -23 },
  { id: 'trottoir_s', name: 'le trottoir', label: 'Trottoir', indoor: false, x0: -30.5, z0: -16, x1: 30.5, z1: -13 },
  { id: 'trottoir_n', name: 'le trottoir', label: 'Trottoir', indoor: false, x0: -30.5, z0: -27.5, x1: 30.5, z1: -23 },
  { id: 'rue', name: 'la rue', label: "Rue de l'École", indoor: false, x0: -30.5, z0: -23, x1: 30.5, z1: -16 },
];

const STREET_ZONES = ['rue', 'trottoir_s', 'trottoir_n', 'boulangerie'];

const FLOORS: FloorPatch[] = [
  { kind: 'parquet', x0: -28.5, z0: 1.5, x1: -16, z1: 12 },
  { kind: 'carpet', x0: -16, z0: 1.5, x1: -7, z1: 12 },
  { kind: 'white_tiles', x0: -7, z0: 1.5, x1: 10, z1: 12 },
  { kind: 'cement_tiles', x0: -28.5, z0: -2, x1: 10, z1: 1.5, rot: 1 },
  { kind: 'terrace', x0: -28.5, z0: -13, x1: -18, z1: -2 },
  { kind: 'asphalt', x0: -18, z0: -13, x1: 10, z1: -2 },
  { kind: 'gravel', x0: 10.2, z0: -12.6, x1: 12.4, z1: 11.6 },
  // Street.
  { kind: 'asphalt', x0: -30.5, z0: -23, x1: 30.5, z1: -16 },
  { kind: 'sidewalk', x0: -30.5, z0: -16, x1: 30.5, z1: -13 },
  { kind: 'sidewalk', x0: -30.5, z0: -27.5, x1: 30.5, z1: -23 },
  { kind: 'crosswalk', x0: -1.6, z0: -22.8, x1: 1.6, z1: -16.2, y: 0.004 },
];

const SHUTTER = 0x2e6b8a;
const WALL = 0xf3e6c8;
const WIN = (at: number, width = 1.6) => ({ at, width, kind: 'window' as const, sill: 0.9, top: 2.2 });

const WALLS: WallDef[] = [
  // --- School building ---
  { id: 'b_north', x0: -28.5, z0: -2, x1: 10, z1: -2, style: 'house_ext', color: WALL, shutter: SHUTTER, openings: [
    WIN(4), WIN(9.5), { at: 17.5, width: 1.8, kind: 'door', door: 'porte_cour' }, WIN(24), WIN(30), WIN(35.5, 1.2),
  ] },
  { id: 'b_south', x0: -28.5, z0: 12, x1: 10, z1: 12, style: 'house_ext', color: WALL, shutter: SHUTTER, openings: [
    WIN(3.5), WIN(9.5), WIN(17), WIN(23.5), WIN(29.5), { at: 35, width: 0.8, kind: 'window', sill: 1.4, top: 2.1 },
  ] },
  { id: 'b_west', x0: -28.5, z0: -2, x1: -28.5, z1: 12, style: 'house_ext', color: WALL, shutter: SHUTTER, openings: [WIN(6), WIN(11)] },
  { id: 'b_east', x0: 10, z0: -2, x1: 10, z1: 12, style: 'house_ext', color: WALL, shutter: SHUTTER, openings: [
    { at: 1.75, width: 1.2, kind: 'door', door: 'porte_potager' },
    { at: 11, width: 0.8, kind: 'window', sill: 1.4, top: 2.1 },
  ] },
  { id: 'i_corridor', x0: -28.5, z0: 1.5, x1: 10, z1: 1.5, style: 'house_int', openings: [
    { at: 10.5, width: 1.1, kind: 'door', door: 'porte_classe' },
    { at: 17, width: 1.1, kind: 'door', door: 'porte_biblio' },
    { at: 27.5, width: 1.1, kind: 'door', door: 'porte_cantine' },
    { at: 35.25, width: 1.1, kind: 'door', door: 'porte_toilettes' },
  ] },
  { id: 'i_classe_biblio', x0: -16, z0: 1.5, x1: -16, z1: 12, style: 'house_int' },
  { id: 'i_biblio_cantine', x0: -7, z0: 1.5, x1: -7, z1: 12, style: 'house_int' },
  { id: 'i_cantine_wc', x0: 4, z0: 1.5, x1: 4, z1: 12, style: 'house_int' },
  // --- Grounds ---
  { id: 'f_front', x0: -28.5, z0: -13, x1: 10, z1: -13, style: 'fence', height: 1.6, openings: [
    { at: 28.5, width: 3.2, kind: 'gate', door: 'portail' },
  ] },
  { id: 'f_front_potager', x0: 10, z0: -13, x1: 28.5, z1: -13, style: 'hedge', openings: [
    { at: 12, width: 1.1, kind: 'doghole' },
  ] },
  { id: 'f_west', x0: -28.5, z0: -13, x1: -28.5, z1: -2, style: 'stone' },
  { id: 'f_east', x0: 28.5, z0: -13, x1: 28.5, z1: 12, style: 'hedge' },
  { id: 'f_south_potager', x0: 10, z0: 12, x1: 28.5, z1: 12, style: 'hedge' },
  { id: 'f_cour_potager', x0: 10, z0: -13, x1: 10, z1: -2, style: 'garden_fence', openings: [
    { at: 5.5, width: 2.2, kind: 'gate', door: 'portillon' },
  ] },
  // --- Street ends ---
  { id: 'e_west', x0: -30.8, z0: -27.5, x1: -30.8, z1: -13, style: 'hedge', height: 2.4 },
  { id: 'e_east', x0: 30.8, z0: -27.5, x1: 30.8, z1: -13, style: 'hedge', height: 2.4 },
];

const BUILDINGS: BuildingDef[] = [
  { id: 'b_n1', x0: -31, z0: -36, x1: -19.4, z1: -27.5, front: 's', storeys: 2, color: 0xe7d6c2, shutter: 0x7ea2c8, door: 0x40566b, doorX: -25 },
  { id: 'b_n2', x0: -19.4, z0: -36, x1: -8.5, z1: -27.5, front: 's', storeys: 2, color: 0xdcb596, shutter: 0xf0ebe0, door: 0x6c3b2a, doorX: -12 },
  { id: 'b_bakery', x0: -8.5, z0: -36, x1: 6.5, z1: -27.5, front: 's', storeys: 2, color: 0xf4ebd6, shutter: 0xb84a3a, door: 0x7a2d24, doorX: 3.5, shop: 'bakery' },
  { id: 'b_n3', x0: 6.5, z0: -36, x1: 19.5, z1: -27.5, front: 's', storeys: 3, color: 0xefc8a2, shutter: 0x4f7ea3, door: 0x2f4f6f, doorX: 13 },
  { id: 'b_n4', x0: 19.5, z0: -36, x1: 31, z1: -27.5, front: 's', storeys: 2, color: 0xe3e0d3, shutter: 0xb06447, door: 0x5b3a2a, doorX: 26 },
];

const INT = 0xf4efe4;
const DOORS: DoorDef[] = [
  { id: 'porte_cour', name: "la porte de l'école", kind: 'exterior', x: -11, z: -2, axis: 'x', width: 1.8, hinge: -1, swing: 1, dogCanPush: false, dogFlap: false, open: true, color: SHUTTER },
  { id: 'porte_potager', name: 'la porte du potager', kind: 'exterior', x: 10, z: -0.25, axis: 'z', width: 1.2, hinge: -1, swing: -1, dogCanPush: false, dogFlap: true, open: false, color: 0x5f9460 },
  { id: 'porte_classe', name: 'la porte de la classe', kind: 'interior', x: -18, z: 1.5, axis: 'x', width: 1.1, hinge: -1, swing: 1, dogCanPush: true, dogFlap: false, open: true, color: 0xf6c453 },
  { id: 'porte_biblio', name: 'la porte de la bibliothèque', kind: 'interior', x: -11.5, z: 1.5, axis: 'x', width: 1.1, hinge: -1, swing: 1, dogCanPush: true, dogFlap: false, open: true, color: 0x7cc4a8 },
  { id: 'porte_cantine', name: 'la porte de la cantine', kind: 'interior', x: -1, z: 1.5, axis: 'x', width: 1.1, hinge: 1, swing: 1, dogCanPush: true, dogFlap: false, open: true, color: 0xf08a6b },
  { id: 'porte_toilettes', name: 'la porte des toilettes', kind: 'interior', x: 6.75, z: 1.5, axis: 'x', width: 1.1, hinge: 1, swing: 1, dogCanPush: true, dogFlap: false, open: true, color: INT },
  { id: 'portail', name: "le portail de l'école", kind: 'gate', x: 0, z: -13, axis: 'x', width: 3.2, hinge: -1, swing: 1, dogCanPush: false, dogFlap: false, open: true, color: 0x2f5d50 },
  { id: 'portillon', name: 'le portillon du potager', kind: 'gate', x: 10, z: -7.5, axis: 'z', width: 2.2, hinge: -1, swing: 1, dogCanPush: false, dogFlap: false, open: false, color: 0x9a7b54 },
];

const DESKS: PropDef[] = [];
for (const x of [-26, -23.5, -21]) for (const z of [3.8, 6.5, 9.2]) DESKS.push({ type: 'school_desk', x, z, rot: 1 });

const PROPS: PropDef[] = [
  // --- Classe ---
  { type: 'blackboard', x: -16.11, z: 6.5, rot: 3 },
  { type: 'teacher_desk', x: -17.6, z: 6.5, rot: 3 },
  { type: 'chair', x: -16.75, z: 6.5, rot: 3, color: 0x8d6e4f },
  ...DESKS,
  { type: 'wardrobe', x: -22.5, z: 11.65, rot: 2 },
  { type: 'easel', x: -26.8, z: 2.5 },
  { type: 'easel', x: -24.2, z: 2.5 },
  { type: 'easel', x: -24.5, z: -9.8, rot: 2 },
  { type: 'easel', x: -22.6, z: -9.8, rot: 2 },
  { type: 'dog_basket', x: -27.5, z: 11.0 },
  // --- Bibliothèque ---
  { type: 'bookshelf', x: -15.755, z: 4, rot: 1, color: 0xf2f2ee },
  { type: 'bookshelf', x: -15.755, z: 9.5, rot: 1, color: 0xf2f2ee },
  { type: 'bookshelf', x: -7.245, z: 4, rot: 3, color: 0xf2f2ee },
  { type: 'bookshelf', x: -7.245, z: 9.5, rot: 3, color: 0xf2f2ee },
  { type: 'bookshelf_low', x: -11.5, z: 11.755, rot: 2 },
  { type: 'rug_round', x: -11.5, z: 6.8, w: 3.4, d: 3.4, color: 0x7cc4a8 },
  { type: 'armchair', x: -14.3, z: 10.6, rot: 1, color: 0xf39c12 },
  // --- Cantine ---
  { type: 'lunch_table', x: -4.5, z: 5 },
  { type: 'lunch_table', x: -4.5, z: 9 },
  { type: 'lunch_table', x: 0.5, z: 5 },
  { type: 'lunch_table', x: 0.5, z: 9 },
  { type: 'counter', x: 3.6, z: 8.5, w: 3.0, rot: 3 },
  { type: 'fridge', x: 3.55, z: 11.4, rot: 3 },
  // --- Toilettes ---
  { type: 'toilet', x: 9.5, z: 10.5, rot: 3 },
  { type: 'toilet', x: 9.5, z: 7.6, rot: 3 },
  { type: 'vanity', x: 4.32, z: 5.5, rot: 1 },
  { type: 'roll_holder', x: 9.79, z: 9.1, rot: 3 },
  // --- Couloir ---
  { type: 'coat_hooks', x: -25, z: 1.37, w: 2.4, rot: 2 },
  { type: 'coat_hooks', x: -14, z: 1.37, w: 2.0, rot: 2 },
  { type: 'lost_box', x: -27.85, z: -0.25, rot: 1 },
  { type: 'bench', x: -21, z: -1.55, rot: 0 },
  { type: 'vacuum_dock', x: 2.0, z: -1.78, rot: 0 },
  { type: 'picture', x: -8.5, z: 1.42, rot: 2, color: 0xf6c453 },
  { type: 'picture', x: 2.5, z: 1.42, rot: 2, color: 0x7cc4a8 },
  // --- Cour ---
  { type: 'plane_tree', x: -6, z: -9 },
  { type: 'bench', x: -6, z: -7.2, rot: 0 },
  { type: 'basket_hoop', x: 9.2, z: -11, rot: 3 },
  { type: 'trestle_table', x: 2, z: -5.5 },
  { type: 'notice_board', x: 3.4, z: -12.7, rot: 0 },
  { type: 'spring_rider', x: -14.5, z: -11.2 },
  { type: 'spring_rider', x: -12.8, z: -11.8, v: 1 },
  { type: 'planter', x: -15.0, z: -2.55, rot: 0 },
  { type: 'planter', x: -7.0, z: -2.55, rot: 0 },
  // --- Préau ---
  { type: 'pillar', x: -18.3, z: -12.6 },
  { type: 'pillar', x: -18.3, z: -9.0 },
  { type: 'pillar', x: -18.3, z: -5.4 },
  { type: 'ball_bin', x: -27.95, z: -6.0, rot: 1 },
  { type: 'dog_basket', x: -27.6, z: -11.9 },
  { type: 'bench', x: -23, z: -12.4, rot: 0 },
  // --- Potager ---
  { type: 'veg_patch', x: 20, z: -8, w: 5, d: 3 },
  { type: 'veg_patch', x: 24.5, z: -1, w: 3.5, d: 4 },
  { type: 'flowerbed', x: 16.5, z: 4.0, w: 3.0, d: 1.2 },
  { type: 'flowerbed', x: 22.5, z: 8.0, w: 3.2, d: 1.2 },
  { type: 'shed', x: 26.4, z: 10.0, rot: 3 },
  { type: 'fruit_tree', x: 17.5, z: 9.5, v: 1 },
  { type: 'bench', x: 19, z: -12.2, rot: 0 },
  { type: 'bush', x: 27.4, z: -11.6 },
  { type: 'bush', x: 13.6, z: 11.2, v: 1 },
  // --- Rue ---
  { type: 'plane_tree', x: -22, z: -15.0 },
  { type: 'plane_tree', x: -9, z: -15.0 },
  { type: 'plane_tree', x: 16, z: -15.0 },
  { type: 'plane_tree', x: 24, z: -15.0 },
  { type: 'plane_tree', x: -24, z: -25.0 },
  { type: 'plane_tree', x: -12, z: -25.0 },
  { type: 'plane_tree', x: 10, z: -25.0 },
  { type: 'plane_tree', x: 26, z: -25.0 },
  { type: 'streetlamp', x: -16, z: -13.5 },
  { type: 'streetlamp', x: 12.4, z: -13.5 },
  { type: 'streetlamp', x: -18, z: -26.5 },
  { type: 'streetlamp', x: 16, z: -26.5 },
  { type: 'bollard', x: -2.4, z: -13.6 },
  { type: 'bollard', x: 2.4, z: -13.6 },
  { type: 'roadsign', x: -4.2, z: -13.6 },
  { type: 'car', x: -17, z: -21.9, rot: 1, color: 0x6aa5c9, v: 1 },
  { type: 'car', x: 21, z: -21.9, rot: 3, color: 0xf2c94c, v: 2 },
  { type: 'car', x: -25, z: -17.1, rot: 1, color: 0x8fbf6a },
  { type: 'car', x: 8, z: -17.1, rot: 3, color: 0xd2483a, v: 1 },
  { type: 'cafe_table', x: 3.8, z: -25.0 },
  { type: 'garden_chair', x: 3.0, z: -25.0, rot: 1, color: 0x2e6b5e },
  { type: 'garden_chair', x: 4.6, z: -25.0, rot: 3, color: 0x2e6b5e },
  { type: 'bakery_stand', x: -2.0, z: -26.75, rot: 0 },
  { type: 'awning', x: -1.0, z: -26.7, w: 13, d: 1.8 },
];

const BASKET_SLOTS: [number, number, number][] = [[-0.2, 0.15, -0.1], [0.2, 0.15, 0.1], [0.0, 0.18, 0.25], [-0.25, 0.2, 0.25], [0.25, 0.2, -0.2]];

const STATIONS: StationDef[] = [
  { id: 'objets_trouves', kind: 'hamper', name: 'le carton des objets trouvés', x: -27.75, z: -0.25, y: 0.5, r: 0.9, hw: 0.25, hd: 0.35, dogReach: false, capacity: 12 },
  { id: 'porte_manteaux', kind: 'coat_hooks', name: 'le porte-manteaux', x: -25, z: 1.15, y: 1.42, r: 0.8, hw: 1.1, hd: 0.1, dogReach: true, capacity: 4,
    slots: [[-0.8, 1.42, 0.12], [-0.27, 1.42, 0.12], [0.27, 1.42, 0.12], [0.8, 1.42, 0.12]] },
  { id: 'porte_manteaux_2', kind: 'coat_hooks', name: 'le porte-manteaux', x: -14, z: 1.15, y: 1.42, r: 0.8, hw: 0.9, hd: 0.1, dogReach: true, capacity: 3,
    slots: [[-0.6, 1.42, 0.12], [0, 1.42, 0.12], [0.6, 1.42, 0.12]] },
  { id: 'armoire', kind: 'cabinet', name: "l'armoire de la classe", x: -22.5, z: 11.2, y: 1.0, r: 0.9, hw: 0.7, hd: 0.2, dogReach: true, capacity: 8 },
  { id: 'bac_ballons', kind: 'toybox', name: 'le bac à ballons', x: -27.95, z: -6.0, y: 0.7, r: 0.9, hw: 0.3, hd: 0.4, dogReach: true, capacity: 6 },
  { id: 'bureau', kind: 'counter', name: 'le bureau de la maîtresse', x: -17.6, z: 6.0, y: 0.76, r: 0.9, hw: 0.35, hd: 0.3, dogReach: true, capacity: 2 },
  { id: 'bocal', kind: 'treat_jar', name: 'le bocal de friandises', x: -17.6, z: 7.0, y: 0.76, r: 0.9, hw: 0.3, hd: 0.3 },
  { id: 'comptoir', kind: 'counter', name: 'le comptoir de la cantine', x: 3.6, z: 8.5, y: 0.92, r: 0.95, hw: 0.3, hd: 0.6, dogReach: true, capacity: 2 },
  { id: 'table_fete', kind: 'garden_table', name: 'la table de la fête', x: 2, z: -5.5, y: 0.78, r: 1.0, hw: 1.0, hd: 0.4, dogReach: true, capacity: 2 },
  { id: 'panneau', kind: 'notice_board', name: "le panneau d'affichage", x: 3.4, z: -12.4, y: 1.35, r: 0.9, hw: 0.6, hd: 0.1, dogReach: true, capacity: 1,
    slots: [[0, 1.36, -0.24]] },
  { id: 'poubelle_rue', kind: 'street_bin', name: 'la poubelle de la rue', x: 6.0, z: -14.0, y: 1.0, r: 1.5, dogReach: false, linkedItem: 'bin_rue', capacity: 2 },
  { id: 'coin_lecture', kind: 'bed', name: 'le coin lecture', x: -11.5, z: 6.8, y: 0.2, r: 0.8, hw: 1.2, hd: 1.2,
    make: {
      verb: 'Ranger les coussins', jump: 'Sauter dans les coussins', undone: 'Coin lecture en bazar !', look: 'cushions', mess: 'muddy_cushions',
      dirty: ['Des coussins pleins de boue !', 'Des coussins tout mouillés !', 'Des feuilles dans les coussins !'],
    } },
  { id: 'derouleur', kind: 'roll_holder', name: 'le dérouleur de papier', x: 9.71, z: 9.1, y: 0.56, r: 0.8, dogReach: true, capacity: 1 },
  { id: 'carre_fraises', kind: 'flowerbed', name: 'le carré de fraises', x: 16.5, z: 4.0, y: 0.2, r: 0.9, hw: 1.5, hd: 0.6 },
  { id: 'carre_tomates', kind: 'flowerbed', name: 'le carré de tomates', x: 22.5, z: 8.0, y: 0.2, r: 0.9, hw: 1.6, hd: 0.6 },
  { id: 'robinet', kind: 'tap', name: 'le robinet', x: 10.45, z: 5.0, y: 0.8, r: 1.0 },
  { id: 'panier_tofu', kind: 'dog_basket', name: 'le panier de Tofu', x: -27.5, z: 11.0, y: 0.12, r: 0.95, capacity: 20, slots: BASKET_SLOTS },
  { id: 'panier_preau', kind: 'dog_basket', name: 'le vieux panier du préau', x: -27.6, z: -11.9, y: 0.12, r: 0.95, capacity: 20, slots: BASKET_SLOTS },
  { id: 'boulangerie', kind: 'bakery', name: 'la boulangerie', x: -2.0, z: -26.75, y: 0.95, r: 1.0, hw: 1.2, hd: 0.35, dogReach: true, capacity: 3,
    slots: [[-0.7, 0.95, 0], [0.0, 0.95, 0], [0.7, 0.95, 0]] },
];

const ITEMS: ItemPlacement[] = [
  // Lost clothes (job) and the coats on the hooks.
  { id: 'bonnet', type: 'beanie', x: -13.5, z: -9.2, rot: 0.4 },
  { id: 'echarpe', type: 'scarf', x: 6.2, z: -3.6, rot: 1.2 },
  { id: 'moufle', type: 'mitten', x: 15.2, z: -2.6, rot: -0.6 },
  { id: 'casquette', type: 'cap', x: -21.5, z: -5.0, rot: 2.0 },
  { id: 'gilet_perdu', type: 'cardigan', x: 26.8, z: 4.5, rot: 0.8 },
  { id: 'gilet', type: 'cardigan', station: 'porte_manteaux' },
  { id: 'bonnet_2', type: 'beanie', station: 'porte_manteaux' },
  { id: 'echarpe_2', type: 'scarf', station: 'porte_manteaux_2' },
  { id: 'casquette_2', type: 'cap', station: 'porte_manteaux_2' },
  // Toys of the class and the snack of the canteen.
  { id: 'doudou', type: 'teddy', x: -12.6, z: 8.4, rot: 0.6 },
  { id: 'dino', type: 'dino', x: -26.6, z: 7.6, rot: 1.4 },
  { id: 'croissants', type: 'croissants', station: 'comptoir' },
  // School supplies.
  { id: 'crayons', type: 'pencil_pot', x: -24.8, z: 5.2 },
  { id: 'colle', type: 'glue', x: -9.0, z: 3.0, rot: 1 },
  { id: 'peinture', type: 'paint_box', x: -24.6, z: -10.6, rot: 0.5 },
  { id: 'cahier', type: 'notebook', x: -2.0, z: 10.9, rot: -0.4 },
  // Balls: the football flew over the railings.
  { id: 'ballon_foot', type: 'football', x: -14, z: -19.5 },
  { id: 'ballon_basket', type: 'basketball', x: 7.8, z: -10.4 },
  // Job objects.
  { id: 'gateau', type: 'cake', station: 'comptoir' },
  { id: 'affiche', type: 'poster', station: 'bureau' },
  { id: 'sac_poubelle', type: 'trash_bag', x: 2.4, z: 2.4, rot: 0.3 },
  { id: 'arrosoir', type: 'watering_can', x: 12.9, z: 6.2, rot: -1.2 },
  { id: 'papier_toilette', type: 'toilet_roll', station: 'derouleur' },
  { id: 'baguette', type: 'baguette', station: 'boulangerie' },
  { id: 'balle', type: 'ball', x: -4, z: -4.5 },
  // Knockables.
  { id: 'pot_peinture_1', type: 'paint_pot', x: -25.5, z: 2.4 },
  { id: 'pot_peinture_2', type: 'paint_pot', x: -23.1, z: 2.6 },
  { id: 'tour_cubes', type: 'toy_tower', x: -20.5, z: 11.2 },
  { id: 'tour_cubes_2', type: 'toy_tower', x: -13.2, z: 3.2 },
  { id: 'pot_peinture_3', type: 'paint_pot', x: -25.2, z: -9.6 },
  { id: 'pot_peinture_4', type: 'paint_pot', x: -23.8, z: -10.9 },
  { id: 'livres_3', type: 'book_pile', x: -9.0, z: 6.0 },
  { id: 'livres_4', type: 'book_pile', x: -27.6, z: 5.0 },
  { id: 'plante_couloir_2', type: 'plant', x: -27.9, z: 1.0 },
  { id: 'plante_couloir_3', type: 'plant', x: -8.0, z: -1.45 },
  { id: 'bin_cantine_2', type: 'kitchen_bin', x: 3.5, z: 2.1 },
  { id: 'pot_cour_1', type: 'flowerpot', x: -16.2, z: -2.65 },
  { id: 'pot_cour_2', type: 'flowerpot', x: -4.2, z: -2.65 },
  { id: 'pot_cour_3', type: 'flowerpot', x: 4.2, z: -2.65 },
  { id: 'bin_cour_3', type: 'public_bin', x: -17.6, z: -2.7 },
  { id: 'seau_potager', type: 'watering_pot', x: 11.0, z: 4.0 },
  { id: 'vase_fete', type: 'vase', x: 2.6, z: -5.5, y: 0.78 },
  { id: 'livres_1', type: 'book_pile', x: -14.6, z: 2.4 },
  { id: 'livres_2', type: 'book_pile', x: -8.4, z: 11.0 },
  { id: 'plante_classe', type: 'plant', x: -16.6, z: 11.4 },
  { id: 'plante_couloir', type: 'plant', x: 9.4, z: 1.0 },
  { id: 'plante_cantine', type: 'plant', x: -6.4, z: 2.2 },
  { id: 'bin_cantine', type: 'kitchen_bin', x: -6.4, z: 11.4 },
  { id: 'pot_entree_1', type: 'flowerpot', x: -12.4, z: -2.6 },
  { id: 'pot_entree_2', type: 'flowerpot', x: -9.6, z: -2.6 },
  { id: 'pot_potager_1', type: 'flowerpot', x: 24.3, z: 8.0 },
  { id: 'pot_potager_2', type: 'flowerpot', x: 23.6, z: 11.2 },
  { id: 'bin_rue', type: 'wheelie_bin', x: 6.0, z: -14.0 },
  { id: 'bin_potager', type: 'wheelie_bin', x: 11.0, z: 11.2 },
  { id: 'bin_cour_1', type: 'public_bin', x: -17.4, z: -12.4 },
  { id: 'bin_cour_2', type: 'public_bin', x: 9.3, z: -2.6 },
  { id: 'seau', type: 'watering_pot', x: 13.2, z: -11.6 },
  // Up high, for the cat.
  { id: 'tasse', type: 'mug', x: -17.45, z: 6.5, y: 0.76, rot: 0.4 },
  { id: 'vase_cantine', type: 'vase', x: 3.6, z: 7.3, y: 0.92 },
  // Autumn.
  { id: 'feuilles_cour', type: 'leaf_pile', x: -13.5, z: -5.6, only: ['automne'] },
  { id: 'feuilles_cour_2', type: 'leaf_pile', x: 5.0, z: -9.8, only: ['automne'] },
  { id: 'feuilles_potager', type: 'leaf_pile', x: 18.5, z: -4.5, only: ['automne'] },
  { id: 'feuilles_potager_2', type: 'leaf_pile', x: 15.0, z: 7.6, only: ['automne'] },
  // Winter.
  { id: 'bonhomme_cour', type: 'snowman', x: -1.5, z: -9.0, rot: 0.3, only: ['hiver'] },
  { id: 'bonhomme_potager', type: 'snowman', x: 20.5, z: -2.5, rot: -0.4, only: ['hiver'] },
];

const PUDDLES: Puddle[] = [
  { id: 'flaque_cour', x: -8.6, z: -6.0, r: 1.1 },
  { id: 'flaque_potager', x: 19.5, z: 1.5, r: 1.3 },
];

const SPAWNS: { tofu: Spawn; humans: Spawn[] } = {
  tofu: { x: -25.5, z: 10.8, facing: Math.PI * 0.75 },
  humans: [
    { x: -11, z: -0.6, facing: 0 },
    { x: -9.6, z: -0.6, facing: 0 },
  ],
};

const CAT_NODES: CatNode[] = [
  // Street
  { id: 's_west', x: -24, z: -14.4, y: 0 },
  { id: 's_mid_w', x: -12, z: -14.4, y: 0 },
  { id: 's_gate', x: 0, z: -14.4, y: 0 },
  { id: 's_mid_e', x: 12, z: -14.4, y: 0 },
  { id: 's_hole', x: 22, z: -14.4, y: 0 },
  { id: 's_east', x: 25, z: -14.4, y: 0 },
  { id: 'road_w', x: -17, z: -19.5, y: 0 },
  { id: 'road_mid', x: 0, z: -19.5, y: 0 },
  { id: 'road_e', x: 24.5, z: -19.5, y: 0 },
  { id: 'car1_roof', x: -17, z: -21.9, y: 1.5, perch: true },
  { id: 'car2_roof', x: 21, z: -21.9, y: 1.5, perch: true },
  { id: 'n_bakery', x: -6, z: -24.1, y: 0 },
  { id: 'n_side_e', x: 24.5, z: -24.1, y: 0 },
  // Cour & préau
  { id: 'c_gate', x: 0, z: -11.6, y: 0 },
  { id: 'c_center', x: -1, z: -7, y: 0 },
  { id: 'c_tree_base', x: -4.6, z: -9.6, y: 0 },
  { id: 'c_tree', x: -6, z: -9, y: 2.6, perch: true },
  { id: 'c_door', x: -11, z: -3.0, y: 0 },
  { id: 'c_west', x: -15, z: -8, y: 0 },
  { id: 'c_east', x: 8.6, z: -7.5, y: 0 },
  { id: 'c_ne', x: 8.6, z: -4, y: 0 },
  { id: 'fence_top', x: 10, z: -4, y: 1.3, perch: true },
  { id: 'p_center', x: -23, z: -7.5, y: 0 },
  { id: 'p_wall_base', x: -27.2, z: -9.0, y: 0 },
  { id: 'p_wall', x: -28.5, z: -9.0, y: 1.7, perch: true },
  // School (in by the cat flap of the garden door, out by the front door)
  { id: 'k_door_in', x: -11, z: -0.6, y: 0, indoor: true },
  { id: 'k_corr_w', x: -18, z: -0.4, y: 0, indoor: true },
  { id: 'k_corr_m', x: -1, z: -0.4, y: 0, indoor: true },
  { id: 'k_corr_e', x: 8.6, z: -0.4, y: 0, indoor: true },
  { id: 'k_classe', x: -18, z: 3.2, y: 0, indoor: true },
  { id: 'k_desk', x: -17.6, z: 6.3, y: 0.78, perch: true, indoor: true },
  { id: 'k_cantine', x: -1, z: 3.4, y: 0, indoor: true },
  { id: 'k_cantine2', x: 2.2, z: 7.5, y: 0, indoor: true },
  { id: 'k_counter', x: 3.6, z: 8.0, y: 0.95, perch: true, indoor: true },
  // Potager
  { id: 'g_flap', x: 11.4, z: -0.25, y: 0 },
  { id: 'g_ne', x: 11.4, z: -4, y: 0 },
  { id: 'g_gate', x: 11.4, z: -7.5, y: 0 },
  { id: 'g_north', x: 16, z: -10.6, y: 0 },
  { id: 'g_hole', x: 22, z: -12.0, y: 0 },
  { id: 'g_center', x: 18, z: 2.0, y: 0 },
  { id: 'g_south', x: 19, z: 7.0, y: 0 },
  { id: 'g_tree', x: 17.5, z: 9.5, y: 2.2, perch: true },
  { id: 'g_shed', x: 23.6, z: 6.4, y: 0 },
  { id: 'shed_roof', x: 26.4, z: 10.0, y: 2.55, perch: true },
];

const CAT_EDGES: CatEdge[] = [
  { a: 's_west', b: 's_mid_w' }, { a: 's_mid_w', b: 's_gate' }, { a: 's_gate', b: 's_mid_e' }, { a: 's_mid_e', b: 's_hole' },
  { a: 's_hole', b: 's_east' },
  { a: 's_mid_w', b: 'road_w' }, { a: 's_gate', b: 'road_mid' }, { a: 's_mid_e', b: 'road_e' },
  { a: 'road_mid', b: 'road_w' }, { a: 'road_mid', b: 'road_e' }, { a: 'road_mid', b: 'n_bakery' }, { a: 'road_e', b: 'n_side_e' },
  { a: 'n_bakery', b: 'n_side_e' },
  { a: 'road_w', b: 'car1_roof', jump: true }, { a: 'road_e', b: 'car2_roof', jump: true },
  { a: 's_gate', b: 'c_gate', door: 'portail' },
  { a: 'c_gate', b: 'c_center' }, { a: 'c_center', b: 'c_tree_base' }, { a: 'c_tree_base', b: 'c_tree', jump: true },
  { a: 'c_center', b: 'c_door' }, { a: 'c_door', b: 'c_west' }, { a: 'c_west', b: 'p_center' },
  { a: 'p_center', b: 'p_wall_base' }, { a: 'p_wall_base', b: 'p_wall', jump: true },
  { a: 'c_center', b: 'c_east' }, { a: 'c_east', b: 'c_ne' }, { a: 'c_ne', b: 'fence_top', jump: true },
  { a: 'fence_top', b: 'g_ne', jump: true },
  { a: 'c_east', b: 'g_gate', door: 'portillon' },
  // Indoors
  { a: 'c_door', b: 'k_door_in', door: 'porte_cour' },
  { a: 'k_door_in', b: 'k_corr_w' }, { a: 'k_door_in', b: 'k_corr_m' }, { a: 'k_corr_m', b: 'k_corr_e' },
  { a: 'k_corr_e', b: 'g_flap', flap: 'porte_potager' },
  { a: 'k_corr_w', b: 'k_classe', door: 'porte_classe' }, { a: 'k_classe', b: 'k_desk', jump: true },
  { a: 'k_corr_m', b: 'k_cantine', door: 'porte_cantine' }, { a: 'k_cantine', b: 'k_cantine2' },
  { a: 'k_cantine2', b: 'k_counter', jump: true },
  // Potager
  { a: 'g_flap', b: 'g_ne' }, { a: 'g_ne', b: 'g_gate' }, { a: 'g_gate', b: 'g_north' }, { a: 'g_north', b: 'g_hole' },
  { a: 'g_hole', b: 's_hole' },
  { a: 'g_flap', b: 'g_center' }, { a: 'g_center', b: 'g_south' }, { a: 'g_south', b: 'g_tree', jump: true },
  { a: 'g_south', b: 'g_shed' }, { a: 'g_shed', b: 'shed_roof', jump: true },
];

export const ECOLE: MapDef = {
  id: 'ecole',
  name: "L'école",
  icon: '🏫',
  desc: "La fête de l'école : la cour, le préau, les classes, la cantine et le potager.",
  story: {
    prepare: "prépare l'école",
    arriving: 'Les parents arrivent',
    ding: "Dring ! Les parents arrivent pour la fête de l'école !",
    notReady: "Oh non ! L'école n'est plus prête !",
    ready: "L'école est prête : la fête est réussie ! 🎉",
    late: "Le temps est écoulé et l'école n'est pas prête…",
    chaos: "Trop de bêtises à l'école ! 😈",
    humans: "Les parents arrivent pour la fête. Finissez toutes les tâches et gardez l'école propre",
    listTitle: 'À faire avant la fête',
    cleanLabel: 'École propre',
    inside: "dans l'école",
    tipStart: "Préparez l'école avant l'arrivée des parents !",
    humanRole: "Prépare la fête de l'école et surveille Tofu !",
  },
  bounds: BOUNDS,
  wallHeight: 2.7,
  zones: ZONES,
  streetZones: STREET_ZONES,
  outsideZones: STREET_ZONES,
  snowyZones: ['cour', 'potager'],
  muddyZones: ['classe', 'bibliotheque'],
  floors: FLOORS,
  walls: WALLS,
  buildings: BUILDINGS,
  doors: DOORS,
  props: PROPS,
  stations: STATIONS,
  items: ITEMS,
  puddles: PUDDLES,
  spawns: SPAWNS,
  catNodes: CAT_NODES,
  catEdges: CAT_EDGES,
  catStart: 'g_center',
  variants: ['ete', 'automne', 'hiver'],
  tasks: {
    objets: {
      title: 'Ranger les objets trouvés', icon: '🧤',
      hint: 'Ramasse les 5 vêtements oubliés dehors (cour, préau, potager) et mets-les dans le carton des objets trouvés, au bout du couloir.',
      spec: { type: 'collect', items: ['bonnet', 'echarpe', 'moufle', 'casquette', 'gilet_perdu'], kinds: ['hamper'], dest: 'objets_trouves', destLabel: 'Objets trouvés' },
    },
    fournitures: {
      title: 'Ranger les fournitures', icon: '✏️',
      hint: "Ramasse les crayons, la colle, la peinture et le cahier dans la classe, et range-les dans l'armoire.",
      spec: { type: 'collect', items: ['crayons', 'colle', 'peinture', 'cahier'], kinds: ['cabinet'], dest: 'armoire', destLabel: 'Armoire' },
    },
    gateau: {
      title: 'Apporter le gâteau', icon: '🎂',
      hint: 'Pose le gâteau de la cantine sur la table de la fête, dans la cour. Si Tofu le mange, rachètes-en un à la boulangerie !',
      spec: {
        type: 'deliver', item: 'gateau', dest: 'table_fete', destLabel: 'Table de la fête', itemLabel: 'Gâteau',
        restock: { station: 'boulangerie', label: 'Boulangerie', verb: 'Acheter un gâteau', thanks: 'Merci madame la boulangère !' },
        keep: true,
      },
    },
    affiche: {
      title: 'Afficher le programme', icon: '📜',
      hint: "Prends l'affiche de la fête sur le bureau de la maîtresse et accroche-la au panneau, près du portail.",
      spec: { type: 'deliver', item: 'affiche', dest: 'panneau', destLabel: 'Panneau', itemLabel: 'Affiche' },
    },
    poubelle: {
      title: 'Sortir la poubelle', icon: '🗑️',
      hint: 'Jette le sac poubelle de la cantine dans la grande poubelle, sur le trottoir.',
      spec: { type: 'deliver', item: 'sac_poubelle', dest: 'poubelle_rue', destLabel: 'Poubelle de la rue', itemLabel: 'Sac poubelle' },
    },
    coin_lecture: {
      title: 'Ranger le coin lecture', icon: '📚',
      hint: 'Va dans la bibliothèque et range les coussins du coin lecture (maintiens le bouton).',
      spec: { type: 'make', station: 'coin_lecture', label: 'Coin lecture' },
    },
    potager: {
      title: 'Arroser le potager', icon: '🍓',
      hint: "Prends l'arrosoir dans le potager et arrose les fraises et les tomates.",
      spec: { type: 'water', beds: ['carre_fraises', 'carre_tomates'], can: 'arrosoir', tap: 'robinet', bedLabel: 'Potager', tapLabel: 'Robinet' },
    },
    ballons: {
      title: 'Ranger les ballons', icon: '⚽',
      hint: 'Le ballon de foot est passé par-dessus la grille ! Rapporte-le avec le ballon de basket dans le bac du préau.',
      spec: { type: 'collect', items: ['ballon_foot', 'ballon_basket'], kinds: ['toybox'], dest: 'bac_ballons', destLabel: 'Bac à ballons' },
    },
  },
  secrets: [
    'voleur', 'tresor', 'rue', 'casse', 'boue_chambre', 'chat', 'poubelles', 'gourmand', 'innocent', 'zoomies', 'lit_sale',
    'baguette', 'creuse', 'aboie', 'facteur', 'papier', 'chaine', 'arrosoir',
  ],
  secretWording: {
    voleur: 'Vole 5 vêtements (bonnets, écharpes, gilets…)',
    tresor: 'Cache 3 objets dans un de tes paniers',
    rue: "Emporte un objet de l'école jusque dans la rue",
    boue_chambre: 'Laisse 12 traces de boue dans la classe et la bibliothèque',
    zoomies: "Déclenche tes zoomies dans l'école",
    lit_sale: 'Saute dans le coin lecture avec les pattes pleines de boue',
    baguette: "Rapporte la baguette de la boulangerie à l'école",
    creuse: 'Creuse un trou dans le potager',
    chaine: 'Fais renverser 2 objets par le chat ou par le robot laveur',
    arrosoir: "Vole l'arrosoir et laisse 15 gouttes dans l'école ou sous le préau",
  },
  vacuum: { x: 2.0, z: -1.53, facing: 0, name: 'le robot laveur', color: 0x2e86de },
  carrier: { z: -14.45, x0: -29.6, x1: 29.6, stopX: 5.5, name: 'la factrice', scared: 'La factrice a eu peur !', look: 'carrier' },
  ai: {
    indoorSpots: [
      [-22.2, 5.2, 'classe'], [-19.5, 10.4, 'classe'], [-11.5, 3.6, 'bibliotheque'], [-12.8, 10, 'bibliotheque'],
      [-2, 7, 'cantine'], [2, 3, 'cantine'], [6.5, 6, 'toilettes'], [-15, -0.4, 'couloir'], [3, -0.4, 'couloir'],
      [-23, -7.5, 'preau'],
    ],
    escapes: [[-24, -9], [0, -19.5], [20, -6], [26, 4], [-11.5, 7], [-6, -5], [15, -19], [-22, 10]],
    streetDrops: [[-6, -19.5], [6, -18.5], [-14, -18.8], [14, -19]],
    entrances: [[-11, -2.7], [10.7, -0.25]],
    protectedDoors: { porte_biblio: 'coin_lecture', porte_classe: 'fournitures', porte_toilettes: '*' },
  },
  roofs: [
    { x0: -28.5, z0: -2, x1: 10, z1: 12, style: 'hip', color: 0xb5553a },
    { x0: -28.5, z0: -12.55, x1: -18.45, z1: -2.45, style: 'flat', y: 3.0, color: 0x8a9399 },
  ],
  road: { z0: -23, z1: -16, walks: [[-16, -13], [-27.5, -23]], crossings: [[-1.6, 1.6]] },
  decor: 'ecole',
};
