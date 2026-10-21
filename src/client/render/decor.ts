// Hand-placed details of each map (street plates, signs, chimney): things that
// do not fit the generic map data. Each routine adds to the shared builders.
import * as THREE from 'three';
import type { GameMap, MapId } from '../../shared/world/mapTypes';
import type { Variant } from '../../shared/world/variants';
import { GeoBuilder } from './geo';
import { Materials } from './materials';
import { textTexture } from './textures';

export interface DecorCtx {
  opaque: GeoBuilder;
  occl: GeoBuilder;
  glass: GeoBuilder;
  roof: GeoBuilder;
  root: THREE.Group;
  mats: Materials;
  map: GameMap;
  season: Variant;
}

export interface SignOpts {
  w: number;
  h: number;
  x: number;
  y: number;
  z: number;
  /** Rotation around Y (0: faces +z). */
  ry?: number;
  bg: string;
  fg: string;
  border?: string;
  font?: string;
  /** Texture resolution. */
  tw?: number;
  th?: number;
  /** Also draw the back side (plates hanging in the air). */
  twoSided?: boolean;
}

/** A flat text panel. */
export function sign(ctx: DecorCtx, text: string, o: SignOpts): void {
  const tw = o.tw ?? Math.round(Math.min(1024, (o.w / o.h) * 160));
  const th = o.th ?? 160;
  const tex = textTexture(text, { w: tw, h: th, bg: o.bg, fg: o.fg, border: o.border, font: o.font });
  const m = new THREE.Mesh(new THREE.PlaneGeometry(o.w, o.h), ctx.mats.sign(tex));
  m.position.set(o.x, o.y, o.z);
  m.rotation.y = o.ry ?? 0;
  ctx.root.add(m);
  if (o.twoSided) {
    const b = m.clone();
    b.rotation.y = (o.ry ?? 0) + Math.PI;
    const n = new THREE.Vector3(Math.sin(o.ry ?? 0), 0, Math.cos(o.ry ?? 0));
    b.position.addScaledVector(n, -0.06);
    ctx.root.add(b);
  }
}

/** Light stone blocks on the corners of a house. */
export function cornerStones(occl: GeoBuilder, r: { x0: number; z0: number; x1: number; z1: number }, levels = 6): void {
  for (const [x, z, sx, sz] of [[r.x0, r.z0, -1, -1], [r.x1, r.z0, 1, -1], [r.x0, r.z1, -1, 1], [r.x1, r.z1, 1, 1]]) {
    for (let k = 0; k < levels; k++) {
      const y = 0.5 + k * 0.36;
      const long = k % 2 === 0;
      occl.box(long ? 0.5 : 0.3, 0.3, 0.06, { x: x - sx * (long ? 0.1 : 0.0), y, z: z + sz * 0.18 }, 0xe0d2b4);
      occl.box(0.06, 0.3, long ? 0.3 : 0.5, { x: x + sx * 0.18, y, z: z - sz * (long ? 0.0 : 0.1) }, 0xe0d2b4);
    }
  }
}

function quartier(ctx: DecorCtx): void {
  const { occl, roof: g, root, mats } = ctx;
  const H = ctx.map.roofs[0];
  cornerStones(occl, H);
  // House number plate next to the front door.
  occl.box(0.24, 0.16, 0.02, { x: -5.4, y: 1.8, z: -6.17 }, 0x2e5e8a);
  occl.box(0.18, 0.1, 0.01, { x: -5.4, y: 1.8, z: -6.185 }, 0xffffff);
  // Outdoor tap on the back wall.
  occl.box(0.08, 0.16, 0.1, { x: 5.6, y: 0.8, z: 6.2 }, 0xb8c2c8);
  occl.cylU(0.02, 0.12, { x: 5.6, y: 0.7, z: 6.25 }, 0xb8c2c8, 8);
  occl.torus(0.25, 0.04, { x: 5.6, y: 0.35, z: 6.3, ry: 0 }, 0x27ae60);
  // Chimney and roof window (same slope as the generic hip roof).
  const z0 = H.z0 - 0.45;
  const z1 = H.z1 + 0.45;
  const halfD = (z1 - z0) / 2;
  const rise = Math.min(2.5, halfD * 0.7);
  const y0 = 2.7;
  const ridgeY = y0 + rise;
  const zm = (z0 + z1) / 2;
  g.box(0.7, 1.6, 0.7, { x: -10.5, y: ridgeY - 0.1, z: zm + 1.2 }, 0xe0d2b4);
  g.box(0.85, 0.12, 0.85, { x: -10.5, y: ridgeY + 0.75, z: zm + 1.2 }, 0xb9ac92);
  g.cylU(0.1, 0.3, { x: -10.6, y: ridgeY + 0.95, z: zm + 1.2 }, 0xc4613a, 8);
  g.box(0.8, 0.05, 1.0, { x: 1.5, y: y0 + rise * 0.5, z: zm + halfD * 0.5, rx: Math.atan2(rise, halfD) }, 0x5d6d7e);

  // French street name plate (blue, white border), both sides.
  const plate = { w: 1.2, h: 0.3, y: 2.35, bg: '#2a4f8f', fg: '#ffffff', border: '#ffffff', font: 'bold 82px Arial, sans-serif', tw: 768, th: 192 };
  sign(ctx, 'RUE DES TILLEULS', { ...plate, x: -13.6, z: -13.47, ry: Math.PI });
  sign(ctx, 'RUE DES TILLEULS', { ...plate, x: -13.6, z: -13.53, ry: 0 });
  sign(ctx, 'TOFU', { w: 0.46, h: 0.13, x: -12.6, y: 0.63, z: 8.115, bg: '#ffffff', fg: '#c0392b', font: 'bold 70px Arial, sans-serif', tw: 256, th: 96 });
  sign(ctx, 'Travaux', { w: 1.2, h: 0.4, x: -29.4, y: 1.35, z: -19.5, ry: Math.PI / 2, bg: '#f1c40f', fg: '#2d3436', border: '#e74c3c', font: 'bold 70px Arial, sans-serif', tw: 384, th: 128 });
  sign(ctx, 'Square des Tilleuls', { w: 2.6, h: 0.45, x: -21.5, y: 2.6, z: -13.2, ry: Math.PI, bg: '#2f5d50', fg: '#f8f1e0', font: 'bold 64px Georgia, serif', tw: 768, th: 128 });
  const arch = new GeoBuilder();
  for (const x of [-24.6, -18.4]) arch.cylU(0.06, 2.8, { x, y: 1.4, z: -13.2 }, 0x2f5d50, 8);
  arch.box(6.4, 0.08, 0.08, { x: -21.5, y: 2.85, z: -13.2 }, 0x2f5d50);
  arch.cylU(0.04, 2.4, { x: 31.55, y: 1.2, z: -13.6 }, 0x95a5a6, 8);
  root.add(arch.mesh(mats.vc));
  sign(ctx, 'Voie sans issue', { w: 1.2, h: 0.3, x: 31.5, y: 2.2, z: -13.6, ry: -Math.PI / 2, bg: '#2a4f8f', fg: '#ffffff', font: 'bold 60px Arial, sans-serif', tw: 512, th: 128 });
}

/** Garden tap with its green hose, on a wall facing +x. */
function wallTap(g: GeoBuilder, x: number, z: number) {
  g.box(0.1, 0.16, 0.08, { x, y: 0.8, z }, 0xb8c2c8);
  g.cylU(0.02, 0.12, { x: x + 0.05, y: 0.7, z }, 0xb8c2c8, 8);
  g.torus(0.25, 0.04, { x: x + 0.1, y: 0.35, z, ry: Math.PI / 2 }, 0x27ae60);
}

function ecole(ctx: DecorCtx): void {
  const { occl, opaque, root, mats } = ctx;
  // Facade: name of the school, motto and flag above the front door.
  sign(ctx, 'ÉCOLE PRIMAIRE DES TILLEULS', { w: 4.6, h: 0.32, x: -11, y: 2.52, z: -2.17, ry: Math.PI, bg: '#f3e6c8', fg: '#2e4a6b', font: 'bold 64px Georgia, serif', tw: 1024, th: 72 });
  sign(ctx, 'Liberté · Égalité · Fraternité', { w: 2.2, h: 0.14, x: -11, y: 2.24, z: -2.17, ry: Math.PI, bg: '#f3e6c8', fg: '#5d6d7e', font: 'italic 40px Georgia, serif', tw: 640, th: 44 });
  occl.cylU(0.02, 1.0, { x: -14.2, y: 2.55, z: -2.62, rx: -1.2 }, 0x95a5a6, 6);
  [0x1f3a93, 0xffffff, 0xe74c3c].forEach((c, i) => occl.box(0.02, 0.38, 0.2, { x: -14.2, y: 2.47, z: -2.5 - i * 0.2 - 0.1 }, c));
  // Arch over the gate.
  const arch = new GeoBuilder();
  for (const x of [-1.78, 1.78]) arch.cylU(0.05, 2.8, { x, y: 1.4, z: -13 }, 0x2f5d50, 8);
  arch.box(3.7, 0.06, 0.06, { y: 2.78, z: -13 }, 0x2f5d50);
  root.add(arch.mesh(mats.vc));
  sign(ctx, 'École des Tilleuls', { w: 2.8, h: 0.42, x: 0, y: 2.48, z: -13, ry: Math.PI, bg: '#2f5d50', fg: '#f8f1e0', font: 'bold 62px Georgia, serif', tw: 768, th: 116, twoSided: true });
  // Street name plate on its post.
  const plate = { w: 1.2, h: 0.3, y: 2.35, bg: '#2a4f8f', fg: '#ffffff', border: '#ffffff', font: 'bold 74px Arial, sans-serif', tw: 768, th: 192 };
  sign(ctx, "RUE DE L'ÉCOLE", { ...plate, x: -4.2, z: -13.57, ry: Math.PI });
  sign(ctx, "RUE DE L'ÉCOLE", { ...plate, x: -4.2, z: -13.63, ry: 0 });
  // Room plates above the doors of the corridor.
  const room = { w: 1.05, h: 0.22, y: 2.36, z: 1.42, ry: Math.PI, bg: '#ffffff', fg: '#2e4a6b', border: '#f6c453', font: 'bold 52px Arial, sans-serif', tw: 384, th: 80 };
  sign(ctx, 'CP · CE1', { ...room, x: -18 });
  sign(ctx, 'Bibliothèque', { ...room, x: -11.5 });
  sign(ctx, 'Cantine', { ...room, x: -1 });
  sign(ctx, 'Toilettes', { ...room, x: 6.75 });
  sign(ctx, 'Objets trouvés', { ...room, w: 1.0, x: -28.2, y: 1.2, z: -0.25, ry: Math.PI / 2 });
  sign(ctx, 'Jardin pédagogique', { w: 1.5, h: 0.3, x: 9.9, y: 1.62, z: -9.6, ry: -Math.PI / 2, bg: '#6b8e23', fg: '#ffffff', font: 'bold 48px Arial, sans-serif', tw: 512, th: 100 });
  // Hopscotch painted on the playground.
  const cells: [number, number][] = [[0, 0], [0, 0.62], [0, 1.24], [-0.31, 1.86], [0.31, 1.86], [0, 2.48], [-0.31, 3.1], [0.31, 3.1]];
  const hx = -10.5;
  const hz = -11.6;
  cells.forEach(([dx, dz], i) => {
    opaque.box(0.58, 0.006, 0.58, { x: hx + dx, y: 0.012, z: hz + dz }, [0xf6c453, 0x74b9ff, 0xff8fab, 0x55efc4][i % 4]);
    for (const [ox, oz, w, d] of [[0, -0.3, 0.62, 0.04], [0, 0.3, 0.62, 0.04], [-0.3, 0, 0.04, 0.62], [0.3, 0, 0.04, 0.62]]) {
      opaque.box(w, 0.008, d, { x: hx + dx + ox, y: 0.013, z: hz + dz + oz }, 0xfdfdfd);
    }
  });
  opaque.cylU(0.45, 0.008, { x: hx, y: 0.012, z: hz + 3.75, sz: 0.7 }, 0xa29bfe, 20);
  // Tap of the vegetable garden.
  wallTap(occl, 10.17, 5.0);
}

function centre(ctx: DecorCtx): void {
  const { occl, opaque, root, mats } = ctx;
  // Facade: name of the mall and the opening banner on the parapet.
  sign(ctx, 'LES GALERIES', { w: 5.2, h: 0.46, x: 0, y: 2.44, z: -7.17, ry: Math.PI, bg: '#2c3e50', fg: '#f6c453', font: 'bold 96px Georgia, serif', tw: 1024, th: 100 });
  sign(ctx, 'GRANDE INAUGURATION !', { w: 7.2, h: 0.46, x: 0, y: 3.02, z: -7.62, ry: Math.PI, bg: '#c0392b', fg: '#ffffff', border: '#f6c453', font: 'bold 80px Arial, sans-serif', tw: 1024, th: 72 });
  sign(ctx, 'Mode', { w: 2.4, h: 0.22, x: -18, y: 2.58, z: -7.17, ry: Math.PI, bg: '#e8a3b5', fg: '#ffffff', font: 'italic bold 60px Georgia, serif', tw: 512, th: 52 });
  sign(ctx, 'Café · Pâtisserie', { w: 2.8, h: 0.22, x: 18, y: 2.58, z: -7.17, ry: Math.PI, bg: '#7a2d24', fg: '#f6e7c8', font: 'italic bold 52px Georgia, serif', tw: 640, th: 52 });
  // Shop signs inside the gallery.
  const shop = { w: 2.6, h: 0.3, y: 2.47, bg: '#ffffff', fg: '#2c3e50', font: 'bold 64px Arial, sans-serif', tw: 640, th: 74 };
  sign(ctx, 'MODE', { ...shop, x: -7.9, z: -1, ry: Math.PI / 2, fg: '#c2185b' });
  sign(ctx, 'JOUETS', { ...shop, x: -7.9, z: 9, ry: Math.PI / 2, fg: '#2e86de' });
  sign(ctx, 'CAFÉ · PÂTISSERIE', { ...shop, x: 7.9, z: -1, ry: -Math.PI / 2, fg: '#7a2d24' });
  sign(ctx, 'SUPERMARCHÉ', { ...shop, x: 7.9, z: 9, ry: -Math.PI / 2, fg: '#27ae60' });
  const plate = { w: 1.0, h: 0.22, y: 2.36, z: 12.92, ry: Math.PI, bg: '#ffffff', fg: '#2c3e50', border: '#95a5a6', font: 'bold 52px Arial, sans-serif', tw: 384, th: 80 };
  sign(ctx, 'Toilettes', { ...plate, x: -4.25 });
  sign(ctx, 'Réserve', { ...plate, x: 4.25 });
  sign(ctx, 'Livraisons', { w: 1.4, h: 0.3, x: 26.17, y: 2.35, z: 13.4, ry: Math.PI / 2, bg: '#f1c40f', fg: '#2d3436', font: 'bold 56px Arial, sans-serif', tw: 512, th: 110 });
  // Car park: bay lines and the "P" sign.
  for (const [z0, z1] of [[-15, -11], [-20.3, -16.3]]) {
    for (let x = -26.5; x <= 26.6; x += 3) opaque.box(0.1, 0.006, z1 - z0, { x, y: 0.011, z: (z0 + z1) / 2 }, 0xf5f6fa);
  }
  for (let x = -28; x <= 28; x += 4) opaque.box(1.2, 0.006, 0.12, { x, y: 0.011, z: -15.65 }, 0xf5f6fa);
  const post = new GeoBuilder();
  post.cylU(0.05, 2.6, { x: -28.6, y: 1.3, z: -20.6 }, 0x95a5a6, 8);
  root.add(post.mesh(mats.vc));
  sign(ctx, 'P', { w: 0.6, h: 0.6, x: -28.6, y: 2.4, z: -20.66, ry: Math.PI, bg: '#2a4f8f', fg: '#ffffff', border: '#ffffff', font: 'bold 110px Arial, sans-serif', tw: 160, th: 160, twoSided: true });
  // Delivery yard: pallets and crates.
  for (const [x, z, n] of [[29.6, -0.6, 3], [29.6, 1.0, 2], [29.6, 7.4, 4]]) {
    for (let k = 0; k < n; k++) {
      occl.box(1.0, 0.12, 1.2, { x, y: 0.06 + k * 0.32, z }, 0xb08850);
      occl.box(0.9, 0.18, 1.0, { x, y: 0.21 + k * 0.32, z }, k % 2 ? 0xc49a6c : 0xd9b48a);
    }
  }
  // Tap of the forecourt, on the facade.
  occl.box(0.08, 0.16, 0.1, { x: 13.6, y: 0.8, z: -7.2 }, 0xb8c2c8);
  occl.cylU(0.02, 0.12, { x: 13.6, y: 0.7, z: -7.25 }, 0xb8c2c8, 8);
  occl.torus(0.25, 0.04, { x: 13.6, y: 0.35, z: -7.3, ry: 0 }, 0x27ae60);
}

function parc(ctx: DecorCtx): void {
  const { occl, opaque, root, mats } = ctx;
  // Arch over the main gate.
  const iron = new GeoBuilder();
  for (const x of [-1.78, 1.78]) iron.cylU(0.05, 2.8, { x, y: 1.4, z: -19 }, 0x2f5d50, 8);
  iron.box(3.7, 0.06, 0.06, { y: 2.78, z: -19 }, 0x2f5d50);
  // Birthday banner and bunting over the picnic deck.
  for (const x of [2.3, 13.7]) iron.cylU(0.05, 2.9, { x, y: 1.45, z: -6.3 }, 0xf5f6fa, 8);
  root.add(iron.mesh(mats.vc));
  sign(ctx, 'Parc des Tilleuls', { w: 2.8, h: 0.42, x: 0, y: 2.48, z: -19, ry: Math.PI, bg: '#2f5d50', fg: '#f8f1e0', font: 'bold 62px Georgia, serif', tw: 768, th: 116, twoSided: true });
  sign(ctx, 'JOYEUX ANNIVERSAIRE !', { w: 5.2, h: 0.5, x: 8, y: 2.3, z: -6.3, ry: Math.PI, bg: '#ff8fab', fg: '#ffffff', border: '#f1c40f', font: 'bold 76px Arial, sans-serif', tw: 1024, th: 100, twoSided: true });
  const flags = [0xe74c3c, 0xf1c40f, 0x3498db, 0x2ecc71, 0x9b59b6, 0xff8fab];
  for (let i = 0; i < 22; i++) {
    const x0 = 2.3 + i * (11.4 / 22);
    const x1 = x0 + 11.4 / 22;
    const sag = (t: number) => 2.78 - Math.sin(t * Math.PI) * 0.25;
    const y0 = sag(i / 22);
    const y1 = sag((i + 1) / 22);
    opaque.tris([x0, y0, -6.3, x1, y1, -6.3, (x0 + x1) / 2, (y0 + y1) / 2 - 0.22, -6.3], flags[i % flags.length]);
  }
  // Snack bar and toilets.
  sign(ctx, 'BUVETTE', { w: 2.2, h: 0.4, x: 24, y: 2.35, z: -10.83, bg: '#27ae60', fg: '#ffffff', border: '#f6c453', font: 'bold 80px Arial, sans-serif', tw: 512, th: 96 });
  sign(ctx, 'Glaces · Crêpes · Boissons', { w: 2.4, h: 0.22, x: 24, y: 2.06, z: -10.83, bg: '#fdf6e3', fg: '#27ae60', font: 'italic bold 44px Georgia, serif', tw: 640, th: 60 });
  sign(ctx, 'WC', { w: 0.6, h: 0.3, x: 28.5, y: 2.35, z: -10.83, bg: '#2a4f8f', fg: '#ffffff', font: 'bold 70px Arial, sans-serif', tw: 160, th: 80 });
  // Tools leaning on the shed.
  occl.cylU(0.02, 1.4, { x: 23.75, y: 0.7, z: 18.0, rz: 0.15 }, 0x9a7650, 6);
  occl.box(0.35, 0.04, 0.05, { x: 23.65, y: 1.38, z: 18.0 }, 0x7f8c8d);
  occl.cylU(0.02, 1.3, { x: 23.75, y: 0.65, z: 22.2, rz: -0.12 }, 0x9a7650, 6);
  occl.box(0.2, 0.25, 0.03, { x: 23.82, y: 0.12, z: 22.2 }, 0x7f8c8d);
}

export const DECOR: Partial<Record<MapId, (ctx: DecorCtx) => void>> = {
  quartier,
  ecole,
  centre,
  parc,
};
