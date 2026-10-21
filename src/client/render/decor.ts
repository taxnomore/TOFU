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

export const DECOR: Partial<Record<MapId, (ctx: DecorCtx) => void>> = {
  quartier,
};
