// Builds the static 3D world (architecture, floors, props, buildings, sky,
// backdrop) from the shared map data. Static geometry is merged by material.
import * as THREE from 'three';
import type { GameMap, RoofDef } from '../../shared/world/mapTypes';
import { PROP_TYPES } from '../../shared/world/propTypes';
import { wallHeight, wallThickness } from '../../shared/world/colliders';
import type { BuildingDef, FloorKind, Opening, WallDef } from '../../shared/world/types';
import { DEFAULT_VARIANT, Variant, presentIn } from '../../shared/world/variants';
import { FaceColors, GeoBuilder, hash, mix, shade } from './geo';
import { Materials } from './materials';
import { DECOR } from './decor';
import { buildProp, setPropSeason } from './props';
import { floorTexture, textTexture } from './textures';

const EXT_WALL = 0xf1e2c2;
/** Height of the dollhouse cut (must match cutUniforms.uCutHeight). */
const CAP_Y = 1.05;
let capsG = new GeoBuilder();
const PLINTH = 0xc9bca2;
const WALL_TOP = 0x8f8475;
const TRIM = 0xf7f4ee;
const DOOR_TOP = 2.15;
const SNOW = 0xf3f7fb;

/** Ambiance the world is being built for (seasonal colors, snow). */
let season: Variant = DEFAULT_VARIANT;
/** Map being built. */
let M: GameMap;

/** Leaves of the distant trees and hedges for the season. */
function leafColor(base: number, i = 0): number {
  if (season === 'automne') return [0xd35400, 0xe67e22, 0xd4a017, 0xb5651d][Math.abs(i) % 4];
  if (season === 'hiver') return mix(base, 0xdfe7ee, 0.75).getHex();
  return base;
}

export interface WorldMeshes {
  root: THREE.Group;
  /** Hidden when the viewer is inside the house. */
  roof: THREE.Object3D;
}

function sideColor(x: number, z: number, style: WallDef['style'], wall: WallDef): number {
  const zn = M.zoneAt(x, z);
  if (zn && zn.indoor && (style === 'house_ext' || style === 'house_int')) return zn.wallColor ?? 0xf3ead8;
  if (style === 'house_ext' || style === 'house_int') return wall.color ?? EXT_WALL;
  switch (style) {
    case 'stone': return 0xcfc3a5;
    case 'low_wall': return 0xeee6d5;
    case 'hedge': return season === 'automne' ? 0x6b8a3a : 0x4f8f3e;
    case 'garden_fence': return 0xb48a5c;
    default: return wall.color ?? EXT_WALL;
  }
}

export function buildWorld(mats: Materials, quality: 'high' | 'medium' | 'low', variant: Variant, map: GameMap): WorldMeshes {
  season = variant;
  M = map;
  setPropSeason(variant);
  const root = new THREE.Group();
  root.name = 'world';
  const opaque = new GeoBuilder();
  const occl = new GeoBuilder();
  const glassG = new GeoBuilder();
  const roofG = new GeoBuilder();
  capsG = new GeoBuilder();

  buildGround(root, mats);
  buildFloors(root, mats);
  for (const w of M.walls) buildWall(w, opaque, occl, glassG);
  for (const r of M.roofs) buildRoof(roofG, r);
  for (const b of M.buildings) buildBuilding(b, occl, glassG, root, mats);
  for (const p of M.props) {
    if (!presentIn(p.only, variant)) continue;
    const t = PROP_TYPES[p.type];
    buildProp(p, opaque, t.tall ? occl : opaque);
  }
  buildPuddles(root, mats);
  DECOR[M.decor]?.({ opaque, occl, glass: glassG, roof: roofG, root, mats, map: M, season });
  buildBackdrop(occl, quality);

  const om = opaque.mesh(mats.vc);
  om.name = 'opaque';
  root.add(om);
  const cm = occl.mesh(mats.vcCut);
  cm.name = 'occluders';
  root.add(cm);
  const gm = glassG.mesh(mats.glassCut, false);
  gm.receiveShadow = false;
  gm.renderOrder = 2;
  root.add(gm);
  const roof = roofG.mesh(mats.vcCut);
  roof.name = 'roof';
  root.add(roof);
  const caps = capsG.mesh(mats.cap, false);
  caps.name = 'caps';
  caps.receiveShadow = false;
  caps.renderOrder = 1;
  root.add(caps);
  return { root, roof };
}

// ---------------------------------------------------------------------------

function buildGround(root: THREE.Group, mats: Materials) {
  const { tile } = floorTexture('grass', 4, season);
  const x0 = -90;
  const x1 = 95;
  const z0 = -85;
  const z1 = 75;
  const g = new THREE.PlaneGeometry(x1 - x0, z1 - z0, 1, 1);
  g.rotateX(-Math.PI / 2);
  g.translate((x0 + x1) / 2, 0, (z0 + z1) / 2);
  const uv = g.getAttribute('uv') as THREE.BufferAttribute;
  const pos = g.getAttribute('position') as THREE.BufferAttribute;
  for (let i = 0; i < uv.count; i++) uv.setXY(i, pos.getX(i) / tile, -pos.getZ(i) / tile);
  const m = new THREE.Mesh(g, mats.floor('grass', season));
  m.receiveShadow = true;
  m.name = 'ground';
  root.add(m);
}

function buildFloors(root: THREE.Group, mats: Materials) {
  const byKind = new Map<FloorKind, number[][]>();
  M.floors.forEach((f, i) => {
    const arr = byKind.get(f.kind) ?? [];
    arr.push([f.x0, f.z0, f.x1, f.z1, f.y ?? 0.012 + (i % 5) * 0.0015, f.rot ?? 0]);
    byKind.set(f.kind, arr);
  });
  // Extend the street visually beyond the ends of the map.
  const road = M.road;
  const B = M.bounds;
  if (road) {
    const add = (kind: FloorKind, z0: number, z1: number, y: number) => {
      const arr = byKind.get(kind) ?? [];
      arr.push([-90, z0, B.x0, z1, y, 0], [B.x1, z0, 95, z1, y, 0]);
      byKind.set(kind, arr);
    };
    add('asphalt', road.z0, road.z1, 0.011);
    for (const [z0, z1] of road.walks) add('sidewalk', z0, z1, 0.012);
  }
  for (const [kind, rects] of byKind) {
    const { tile } = floorTexture(kind, 4, season);
    const pos: number[] = [];
    const uvs: number[] = [];
    const nrm: number[] = [];
    const idx: number[] = [];
    for (const [x0, z0, x1, z1, y, rot] of rects) {
      const base = pos.length / 3;
      const corners = [[x0, z0], [x1, z0], [x1, z1], [x0, z1]];
      for (const [x, z] of corners) {
        pos.push(x, y, z);
        nrm.push(0, 1, 0);
        if (kind === 'crosswalk') uvs.push((x - x0) / (x1 - x0) * ((x1 - x0) / tile), 0.5);
        else if (rot) uvs.push(z / tile, x / tile);
        else uvs.push(x / tile, -z / tile);
      }
      idx.push(base, base + 2, base + 1, base, base + 3, base + 2);
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    g.setAttribute('normal', new THREE.Float32BufferAttribute(nrm, 3));
    g.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
    g.setIndex(idx);
    const m = new THREE.Mesh(g, mats.floor(kind, season));
    m.receiveShadow = true;
    m.name = 'floor:' + kind;
    if (kind === 'crosswalk') m.renderOrder = 1;
    root.add(m);
  }
  if (!road) return;
  // Curbs along the road.
  const curbs = new GeoBuilder();
  for (const z of [road.z1, road.z0]) curbs.box(185, 0.12, 0.25, { x: 2.5, y: 0.06, z }, 0xd9d4ca);
  root.add(curbs.mesh(mats.vc, false));
  // Road markings (dashed center line, interrupted at the crossings).
  const marks = new GeoBuilder();
  const mid = (road.z0 + road.z1) / 2;
  for (let x = -88; x < 93; x += 4) {
    if (road.crossings.some(([a, b]) => x > a && x < b)) continue;
    marks.box(2.0, 0.01, 0.14, { x: x + 1, y: 0.018, z: mid }, 0xf2efe6);
  }
  root.add(marks.mesh(mats.vc, false));
}

// ---------------------------------------------------------------------------

function buildWall(w: WallDef, opaque: GeoBuilder, occl: GeoBuilder, glass: GeoBuilder) {
  const t = wallThickness(w);
  const h = wallHeight(w);
  const L = Math.hypot(w.x1 - w.x0, w.z1 - w.z0);
  const alongX = Math.abs(w.z1 - w.z0) < 1e-6;
  const ux = (w.x1 - w.x0) / L;
  const uz = (w.z1 - w.z0) / L;
  const isHouse = w.style === 'house_ext' || w.style === 'house_int';
  const target = isHouse || w.style === 'hedge' || w.style === 'stone' ? occl : opaque;
  // Normal pointing to the "+" side.
  const nx = alongX ? 0 : 1;
  const nz = alongX ? 1 : 0;

  const midPoint = (a: number, b: number) => ({ x: w.x0 + ux * (a + b) / 2, z: w.z0 + uz * (a + b) / 2 });
  const box = (a: number, b: number, y0: number, y1: number, extend: boolean) => {
    if (b - a < 0.005 || y1 - y0 < 0.005) return;
    const ext0 = extend && a <= 1e-6 ? t / 2 : 0;
    const ext1 = extend && b >= L - 1e-6 ? t / 2 : 0;
    const ax = w.x0 + ux * (a - ext0);
    const az = w.z0 + uz * (a - ext0);
    const bx = w.x0 + ux * (b + ext1);
    const bz = w.z0 + uz * (b + ext1);
    const m = midPoint(a, b);
    const cPlus = sideColor(m.x + nx * 0.3, m.z + nz * 0.3, w.style, w);
    const cMinus = sideColor(m.x - nx * 0.3, m.z - nz * 0.3, w.style, w);
    const top = w.style === 'hedge' ? 0x5a9a48 : w.style === 'low_wall' || w.style === 'stone' ? shade(cPlus, 0.88) : WALL_TOP;
    const reveal = isHouse ? TRIM : shade(cPlus, 0.92);
    let x0: number, x1: number, z0: number, z1: number;
    let faces: FaceColors;
    if (alongX) {
      x0 = Math.min(ax, bx); x1 = Math.max(ax, bx);
      z0 = w.z0 - t / 2; z1 = w.z0 + t / 2;
      faces = [reveal, reveal, top, top, cPlus, cMinus];
    } else {
      x0 = w.x0 - t / 2; x1 = w.x0 + t / 2;
      z0 = Math.min(az, bz); z1 = Math.max(az, bz);
      faces = [cPlus, cMinus, top, top, reveal, reveal];
    }
    if (w.style === 'hedge') {
      target.box(x1 - x0, y1 - y0, z1 - z0, { x: (x0 + x1) / 2, y: (y0 + y1) / 2, z: (z0 + z1) / 2 }, season === 'automne' ? 0x6b8a3a : 0x4f8f3e, 0.18);
    } else {
      target.boxFaces(x0, y0, z0, x1, y1, z1, faces);
    }
    // Section cap shown when the wall is lowered around the player.
    if (target === occl && y0 < CAP_Y && y1 > CAP_Y + 0.05) {
      const capCol = w.style === 'hedge' ? 0x3f7a32 : w.style === 'stone' ? 0xa89a7c : 0x9c8b77;
      capsG.boxAt(x0, CAP_Y - 0.01, z0, x1, CAP_Y + 0.004, z1, capCol);
    }
  };

  const openings = [...(w.openings ?? [])].sort((p, q) => p.at - q.at);
  if (w.style === 'fence') {
    ironFence(w, opaque, h, L, openings);
    return;
  }
  // Full-height spans between openings; windows get a sill part and a lintel part.
  let cur = 0;
  const cuts = openings.filter((o) => o.kind !== 'window');
  for (const o of openings) {
    const a = o.at - o.width / 2;
    const b = o.at + o.width / 2;
    box(cur, a, 0, h, true);
    if (o.kind === 'window') {
      box(a, b, 0, o.sill ?? 0.9, false);
      box(a, b, o.top ?? 2.1, h, false);
      window_(w, o, target, isHouse ? occl : opaque, glass, t, h);
    } else if (isHouse && (o.kind === 'door' || o.kind === 'arch')) {
      const top = o.kind === 'arch' ? 2.3 : DOOR_TOP;
      box(a, b, top, h, false);
      doorFrame(w, o, occl, top, t);
    } else if (o.kind === 'doghole') {
      box(a, b, 0.75, h, false);
    } else if (o.kind === 'gate') {
      gatePosts(w, o, opaque, h);
    }
    cur = b;
  }
  box(cur, L, 0, h, true);

  // Decorative extras per style.
  if (w.style === 'hedge') hedgeTop(w, occl, h, t, L);
  if (w.style === 'low_wall' || w.style === 'stone') wallCap(w, opaque, h, t, L, cuts);
  if (w.style === 'garden_fence') fencePickets(w, opaque, h, L, cuts);
  if (w.style === 'house_ext') plinth(w, occl, t, L, cuts);
  if (w.style === 'house_int') skirting(w, occl, t, L, cuts);
}

/** Window: the wall span is already solid; we overlay a recessed frame, glass and shutters. */
function window_(w: WallDef, o: Opening, target: GeoBuilder, opaque: GeoBuilder, glass: GeoBuilder, t: number, h: number) {
  const L = Math.hypot(w.x1 - w.x0, w.z1 - w.z0);
  const ux = (w.x1 - w.x0) / L;
  const uz = (w.z1 - w.z0) / L;
  const alongX = Math.abs(uz) < 1e-6;
  const sill = o.sill ?? 0.9;
  const top = o.top ?? 2.1;
  const cx = w.x0 + ux * o.at;
  const cz = w.z0 + uz * o.at;
  const ww = o.width;
  const hh = top - sill;
  const cy = (sill + top) / 2;
  const ry = alongX ? 0 : Math.PI / 2;
  // "Hole": paint both faces of the opening with a darker glass-backing quad slightly proud of the wall
  // so the wall reads as having a window. The glass is semi transparent; the backing is not drawn so
  // the interior shows through the cutout material anyway.
  const isExt = w.style === 'house_ext';
  // Frames on both sides.
  for (const s of [-1, 1]) {
    const off = s * (t / 2 + 0.012);
    const ox = alongX ? 0 : off;
    const oz = alongX ? off : 0;
    opaque.box(ww + 0.12, 0.07, 0.03, { x: cx + ox, y: top + 0.03, z: cz + oz, ry }, TRIM);
    opaque.box(ww + 0.12, 0.06, 0.04, { x: cx + ox * 1.4, y: sill - 0.02, z: cz + oz * 1.4, ry }, s > 0 ? TRIM : 0xe8dfcf);
    for (const e of [-1, 1]) {
      const ex = alongX ? e * (ww / 2 + 0.03) : 0;
      const ez = alongX ? 0 : e * (ww / 2 + 0.03);
      opaque.box(0.06, hh, 0.03, { x: cx + ox + ex, y: cy, z: cz + oz + ez, ry }, TRIM);
    }
  }
  // Pane: glass + mullions, dark backing when closed so the wall reads as a window.
  if (o.open) {
    // Casement open inward at 70 degrees (cat route).
    for (const e of [-1, 1]) {
      const px = alongX ? cx + e * ww / 2 : cx;
      const pz = alongX ? cz : cz + e * ww / 2;
      const ang = ry + e * 1.2;
      const dx = Math.cos(ang) * (-e) * ww / 4;
      const dz = -Math.sin(ang) * (-e) * ww / 4;
      glass.box(ww / 2 - 0.04, hh - 0.08, 0.02, { x: px + dx, y: cy, z: pz + dz + (alongX ? 0.18 : 0), ry: ang }, 0xffffff);
    }
  } else {
    glass.box(ww - 0.02, hh - 0.02, 0.03, { x: cx, y: cy, z: cz, ry }, 0xffffff);
    opaque.box(0.04, hh, 0.05, { x: cx, y: cy, z: cz, ry }, TRIM);
    opaque.box(ww, 0.04, 0.05, { x: cx, y: cy + hh * 0.1, z: cz, ry }, TRIM);
  }
  // Remove the wall material behind the glass: we draw the window "reveal" as a darker inset on
  // each face (gives depth) by adding thin boxes with the room/exterior colors around the pane.
  void target;
  void h;
  // Shutters (exterior side, folded open against the facade).
  if (isExt && (w.shutter ?? 0) >= 0) {
    const side = outwardSign(w, cx, cz);
    const col = w.shutter ?? 0x5d86a6;
    const off = side * (t / 2 + 0.035);
    for (const e of [-1, 1]) {
      const sw = ww / 2 + 0.04;
      const along = e * (ww / 2 + 0.06 + sw / 2);
      const sx = alongX ? cx + along : cx + off;
      const sz = alongX ? cz + off : cz + along;
      opaque.box(sw, hh + 0.08, 0.035, { x: sx, y: cy, z: sz, ry }, col);
      for (let k = 0; k < 6; k++) {
        const yy = sill + 0.12 + k * ((hh - 0.2) / 5);
        const lx = alongX ? sx : sx + side * 0.02;
        const lz = alongX ? sz + side * 0.02 : sz;
        opaque.box(sw - 0.06, 0.025, 0.01, { x: lx, y: yy, z: lz, ry }, shade(col, 0.82));
      }
    }
    // Flower box under ground floor windows on the front facade.
    if (w.id === 'w_front' && ww >= 1.2 && !o.open) {
      const bx = alongX ? cx : cx + off * 2;
      const bz = alongX ? cz + off * 3 : cz;
      opaque.box(ww * 0.9, 0.18, 0.2, { x: bx, y: sill - 0.12, z: bz, ry }, 0xb5653b);
      for (let k = 0; k < 6; k++) {
        const fx = alongX ? bx - ww * 0.4 + k * (ww * 0.16) : bx;
        const fz = alongX ? bz : bz - ww * 0.4 + k * (ww * 0.16);
        opaque.ico(0.07, { x: fx, y: sill + 0.03, z: fz }, k % 2 ? 0xe74c3c : 0xff8fab);
        opaque.ico(0.07, { x: fx + 0.03, y: sill - 0.01, z: fz + 0.02 }, 0x4f9a46);
      }
    }
  }
}

function outwardSign(w: WallDef, cx: number, cz: number): number {
  const alongX = Math.abs(w.z1 - w.z0) < 1e-6;
  const px = alongX ? cx : cx + 0.5;
  const pz = alongX ? cz + 0.5 : cz;
  const zn = M.zoneAt(px, pz);
  return zn && zn.indoor ? -1 : 1;
}

function doorFrame(w: WallDef, o: Opening, opaque: GeoBuilder, top: number, t: number) {
  const L = Math.hypot(w.x1 - w.x0, w.z1 - w.z0);
  const ux = (w.x1 - w.x0) / L;
  const uz = (w.z1 - w.z0) / L;
  const alongX = Math.abs(uz) < 1e-6;
  const cx = w.x0 + ux * o.at;
  const cz = w.z0 + uz * o.at;
  const ry = alongX ? 0 : Math.PI / 2;
  for (const s of [-1, 1]) {
    const off = s * (t / 2 + 0.01);
    const ox = alongX ? 0 : off;
    const oz = alongX ? off : 0;
    opaque.box(o.width + 0.16, 0.08, 0.025, { x: cx + ox, y: top + 0.04, z: cz + oz, ry }, TRIM);
    for (const e of [-1, 1]) {
      const ex = alongX ? e * (o.width / 2 + 0.04) : 0;
      const ez = alongX ? 0 : e * (o.width / 2 + 0.04);
      opaque.box(0.08, top, 0.025, { x: cx + ox + ex, y: top / 2, z: cz + oz + ez, ry }, TRIM);
    }
  }
  // Threshold.
  opaque.box(o.width, 0.02, t + 0.02, { x: cx, y: 0.01, z: cz, ry }, o.kind === 'arch' ? 0xb98b5c : 0xb9b1a5);
  if (w.style === 'house_ext') {
    // Door step outside.
    const side = outwardSign(w, cx, cz);
    const sx = alongX ? cx : cx + side * (t / 2 + 0.3);
    const sz = alongX ? cz + side * (t / 2 + 0.3) : cz;
    opaque.box(o.width + 0.5, 0.08, 0.6, { x: sx, y: 0.04, z: sz, ry }, 0xc8bca8);
    // Wall lamp next to the door.
    const lx = alongX ? cx + o.width / 2 + 0.35 : cx + side * (t / 2 + 0.06);
    const lz = alongX ? cz + side * (t / 2 + 0.06) : cz + o.width / 2 + 0.35;
    opaque.box(0.14, 0.24, 0.1, { x: lx, y: 2.1, z: lz }, 0x2d3436);
    opaque.box(0.1, 0.16, 0.12, { x: lx, y: 2.08, z: lz }, 0xfff1b8);
  }
}

function gatePosts(w: WallDef, o: Opening, opaque: GeoBuilder, h: number) {
  const L = Math.hypot(w.x1 - w.x0, w.z1 - w.z0);
  const ux = (w.x1 - w.x0) / L;
  const uz = (w.z1 - w.z0) / L;
  for (const e of [-1, 1]) {
    const a = o.at + e * (o.width / 2 + 0.12);
    const x = w.x0 + ux * a;
    const z = w.z0 + uz * a;
    const ph = Math.max(h + 0.25, 1.35);
    opaque.box(0.28, ph, 0.28, { x, y: ph / 2, z }, 0xe9e0cf);
    opaque.box(0.34, 0.07, 0.34, { x, y: ph + 0.035, z }, 0xcfc4ae);
    opaque.sphere(0.09, { x, y: ph + 0.14, z }, 0xcfc4ae);
  }
}

/** School railings: dark green bars between two rails, gates left open. */
function ironFence(w: WallDef, opaque: GeoBuilder, h: number, L: number, openings: Opening[]) {
  const ux = (w.x1 - w.x0) / L;
  const uz = (w.z1 - w.z0) / L;
  const alongX = Math.abs(uz) < 1e-6;
  const col = w.color ?? 0x2f5d50;
  const cuts = openings.filter((o) => o.kind !== 'window');
  let cur = 0;
  const spans: [number, number][] = [];
  for (const o of cuts) {
    spans.push([cur, o.at - o.width / 2]);
    cur = o.at + o.width / 2;
    if (o.kind === 'gate') gatePosts(w, o, opaque, h);
  }
  spans.push([cur, L]);
  for (const [a, b] of spans) {
    if (b - a < 0.05) continue;
    const m = (a + b) / 2;
    const x = w.x0 + ux * m;
    const z = w.z0 + uz * m;
    for (const y of [0.15, h - 0.12]) opaque.box(alongX ? b - a : 0.05, 0.05, alongX ? 0.05 : b - a, { x, y, z }, col);
    opaque.box(alongX ? b - a : 0.22, 0.12, alongX ? 0.22 : b - a, { x, y: 0.06, z }, 0xb7ab8d);
    for (let s = a + 0.06; s < b; s += 0.14) {
      const px = w.x0 + ux * s;
      const pz = w.z0 + uz * s;
      opaque.box(0.025, h, 0.025, { x: px, y: h / 2, z: pz }, col);
      opaque.cone(0.03, 0.08, { x: px, y: h + 0.04, z: pz }, col);
    }
    for (let s = a; s <= b + 1e-6; s += Math.max(1.2, (b - a) / Math.ceil((b - a) / 2.4))) {
      opaque.box(0.07, h + 0.1, 0.07, { x: w.x0 + ux * s, y: (h + 0.1) / 2, z: w.z0 + uz * s }, shade(col, 0.8));
    }
  }
}

function hedgeTop(w: WallDef, occl: GeoBuilder, h: number, t: number, L: number) {
  const ux = (w.x1 - w.x0) / L;
  const uz = (w.z1 - w.z0) / L;
  const seed = Math.round(w.x0 * 7 + w.z0 * 13);
  for (let s = 0.3; s < L - 0.2; s += 0.75) {
    const x = w.x0 + ux * s;
    const z = w.z0 + uz * s;
    const green = season === 'hiver' ? SNOW : season === 'automne' ? 0x7a8a3a : 0x4f8f3e;
    if ((w.openings ?? []).some((o) => o.kind === 'doghole' && Math.abs(o.at - s) < o.width / 2 + 0.2)) {
      occl.ico(t * 0.5, { x, y: h - 0.05, z }, shade(green, 0.95 + hash(Math.round(s * 10), seed) * 0.2), 0.15);
      continue;
    }
    occl.ico(t * 0.55, { x: x + (hash(Math.round(s * 10), seed) - 0.5) * 0.2, y: h - 0.05 + hash(Math.round(s * 10) + 3, seed) * 0.15, z }, shade(green, 0.92 + hash(Math.round(s * 10) + 5, seed) * 0.25), 0.15);
  }
}

function wallCap(w: WallDef, opaque: GeoBuilder, h: number, t: number, L: number, cuts: Opening[]) {
  const ux = (w.x1 - w.x0) / L;
  const uz = (w.z1 - w.z0) / L;
  let cur = 0;
  const spans: [number, number][] = [];
  for (const o of cuts) {
    spans.push([cur, o.at - o.width / 2]);
    cur = o.at + o.width / 2;
  }
  spans.push([cur, L]);
  for (const [a, b] of spans) {
    if (b - a < 0.05) continue;
    const m = (a + b) / 2;
    const x = w.x0 + ux * m;
    const z = w.z0 + uz * m;
    const len = b - a + (a <= 0 ? t / 2 : 0) + (b >= L ? t / 2 : 0);
    const alongX = Math.abs(uz) < 1e-6;
    const cap = season === 'hiver' ? SNOW : w.style === 'stone' ? 0xb7ab8d : 0xd8ccb5;
    opaque.box(alongX ? len : t + 0.08, season === 'hiver' ? 0.1 : 0.07, alongX ? t + 0.08 : len, { x, y: h + 0.035, z }, cap);
  }
}

function fencePickets(w: WallDef, opaque: GeoBuilder, h: number, L: number, cuts: Opening[]) {
  const ux = (w.x1 - w.x0) / L;
  const uz = (w.z1 - w.z0) / L;
  for (let s = 0.06; s < L; s += 0.16) {
    if (cuts.some((o) => Math.abs(o.at - s) < o.width / 2)) continue;
    const x = w.x0 + ux * s;
    const z = w.z0 + uz * s;
    opaque.box(0.1, h, 0.03, { x, y: h / 2, z, ry: Math.abs(uz) < 1e-6 ? 0 : Math.PI / 2 }, shade(0xc79a68, 0.92 + hash(Math.round(s * 100), 3) * 0.16));
    opaque.cone(0.06, 0.1, { x, y: h + 0.05, z }, 0xc79a68);
  }
}

function plinth(w: WallDef, opaque: GeoBuilder, t: number, L: number, cuts: Opening[]) {
  const ux = (w.x1 - w.x0) / L;
  const uz = (w.z1 - w.z0) / L;
  const alongX = Math.abs(uz) < 1e-6;
  let cur = -t / 2;
  const spans: [number, number][] = [];
  for (const o of cuts) {
    spans.push([cur, o.at - o.width / 2 - 0.1]);
    cur = o.at + o.width / 2 + 0.1;
  }
  spans.push([cur, L + t / 2]);
  for (const [a, b] of spans) {
    if (b - a < 0.05) continue;
    const m = (a + b) / 2;
    const cx = w.x0 + ux * m;
    const cz = w.z0 + uz * m;
    const side = outwardSign(w, w.x0 + ux * Math.min(Math.max(m, 0.5), L - 0.5), w.z0 + uz * Math.min(Math.max(m, 0.5), L - 0.5));
    const off = side * (t / 2 + 0.02);
    opaque.box(alongX ? b - a : 0.04, 0.45, alongX ? 0.04 : b - a, { x: alongX ? cx : cx + off, y: 0.225, z: alongX ? cz + off : cz }, PLINTH);
  }
}

function skirting(w: WallDef, opaque: GeoBuilder, t: number, L: number, cuts: Opening[]) {
  const ux = (w.x1 - w.x0) / L;
  const uz = (w.z1 - w.z0) / L;
  const alongX = Math.abs(uz) < 1e-6;
  let cur = 0;
  const spans: [number, number][] = [];
  for (const o of cuts) {
    spans.push([cur, o.at - o.width / 2 - 0.08]);
    cur = o.at + o.width / 2 + 0.08;
  }
  spans.push([cur, L]);
  for (const [a, b] of spans) {
    if (b - a < 0.05) continue;
    const m = (a + b) / 2;
    const cx = w.x0 + ux * m;
    const cz = w.z0 + uz * m;
    for (const s of [-1, 1]) {
      const off = s * (t / 2 + 0.01);
      opaque.box(alongX ? b - a : 0.02, 0.09, alongX ? 0.02 : b - a, { x: alongX ? cx : cx + off, y: 0.045, z: alongX ? cz + off : cz }, 0xffffff);
    }
  }
}

function buildRoof(g: GeoBuilder, R: RoofDef) {
  const o = 0.45;
  const x0 = R.x0 - o;
  const x1 = R.x1 + o;
  const z0 = R.z0 - o;
  const z1 = R.z1 + o;
  const y0 = R.y ?? 2.7;
  const snowy = season === 'hiver';
  const zm = (z0 + z1) / 2;
  if (R.style === 'flat') {
    // Flat roof with a low parapet (schools, shops).
    const top = snowy ? 0xf1f5f9 : R.color ?? 0x9aa3a8;
    g.box(x1 - x0, 0.2, z1 - z0, { x: (x0 + x1) / 2, y: y0 + 0.1, z: zm }, top);
    const par = 0xd8d2c6;
    for (const z of [z0, z1]) g.box(x1 - x0, 0.45, 0.2, { x: (x0 + x1) / 2, y: y0 + 0.32, z }, par);
    for (const x of [x0, x1]) g.box(0.2, 0.45, z1 - z0, { x, y: y0 + 0.32, z: zm }, par);
    g.box(x1 - x0, 0.04, z1 - z0, { x: (x0 + x1) / 2, y: y0 - 0.02, z: zm }, 0xe9e1d2);
    return;
  }
  const halfD = (z1 - z0) / 2;
  const rise = Math.min(2.5, halfD * 0.7);
  const ridgeY = y0 + rise;
  const hip = R.style === 'hip';
  const rx0 = hip ? x0 + halfD : x0;
  const rx1 = hip ? x1 - halfD : x1;
  const bands = 9;
  const c1 = snowy ? 0xf1f5f9 : R.color ?? 0xc4613a;
  const c2 = snowy ? 0xe2e9f0 : shade(R.color ?? 0xc4613a, 0.92);
  const lerp = (a: number[], b: number[], t: number) => a.map((v, i) => v + (b[i] - v) * t);
  // Two trapezoids (north/south) split into bands for a tiled look.
  for (const side of [-1, 1]) {
    const ez = side < 0 ? z0 : z1;
    const A = [x0, y0, ez];
    const B = [x1, y0, ez];
    const C = [rx1, ridgeY, zm];
    const D = [rx0, ridgeY, zm];
    for (let i = 0; i < bands; i++) {
      const t0 = i / bands;
      const t1 = (i + 1) / bands;
      g.quad4(lerp(A, D, t0), lerp(B, C, t0), lerp(B, C, t1), lerp(A, D, t1), i % 2 ? c1 : c2);
    }
  }
  // East/west: hips, or gable walls.
  for (const side of [-1, 1]) {
    const ex = side < 0 ? x0 : x1;
    const rx = side < 0 ? rx0 : rx1;
    const A = [ex, y0, z0];
    const B = [ex, y0, z1];
    const C = [rx, ridgeY, zm];
    if (!hip) {
      g.tris([ex, y0, z0, ex, y0, z1, ex, ridgeY, zm], EXT_WALL);
      continue;
    }
    for (let i = 0; i < bands; i++) {
      const t0 = i / bands;
      const t1 = (i + 1) / bands;
      g.quad4(lerp(A, C, t0), lerp(B, C, t0), lerp(B, C, t1), lerp(A, C, t1), i % 2 ? c1 : c2);
    }
  }
  // Ridge and gutters.
  g.box(rx1 - rx0 + 0.1, 0.12, 0.18, { x: (rx0 + rx1) / 2, y: ridgeY + 0.04, z: zm }, snowy ? 0xf7fafc : shade(c1, 0.8));
  for (const z of [z0, z1]) g.box(x1 - x0, 0.1, 0.12, { x: (x0 + x1) / 2, y: y0 - 0.03, z }, 0xdfe6e9);
  for (const x of [x0, x1]) g.box(0.12, 0.1, z1 - z0, { x, y: y0 - 0.03, z: zm }, 0xdfe6e9);
  // Soffit (underside) so the roof looks solid from below.
  g.box(x1 - x0, 0.04, z1 - z0, { x: (x0 + x1) / 2, y: y0 - 0.02, z: zm }, 0xe9e1d2);
}

function buildBuilding(b: BuildingDef, occl: GeoBuilder, glass: GeoBuilder, root: THREE.Group, mats: Materials) {
  const H = b.storeys * 2.9 + 0.2;
  const W = b.x1 - b.x0;
  const D = b.z1 - b.z0;
  const cx = (b.x0 + b.x1) / 2;
  const cz = (b.z0 + b.z1) / 2;
  const frontZ = b.front === 'n' ? b.z0 : b.z1;
  const fs = b.front === 'n' ? -1 : 1;
  occl.box(W, H, D, { x: cx, y: H / 2, z: cz }, b.color);
  // Base band.
  occl.box(W + 0.04, 0.5, 0.04, { x: cx, y: 0.25, z: frontZ + fs * 0.02 }, shade(b.color, 0.82));
  // Floor band.
  occl.box(W + 0.04, 0.12, 0.06, { x: cx, y: 2.95, z: frontZ + fs * 0.03 }, shade(b.color, 0.9));
  // Roof (gable along x).
  const o = 0.35;
  const y0 = H;
  const rise = Math.min(3.2, D * 0.32);
  const A = [b.x0 - o, y0, b.z0 - o];
  const B2 = [b.x1 + o, y0, b.z0 - o];
  const C = [b.x1 + o, y0 + rise, cz];
  const Dd = [b.x0 - o, y0 + rise, cz];
  const roofCol = season === 'hiver' ? 0xeef2f6 : b.shop ? 0x8a8d91 : 0xbf5d36;
  occl.quad4(A, B2, C, Dd, roofCol);
  occl.quad4([b.x0 - o, y0, b.z1 + o], [b.x1 + o, y0, b.z1 + o], C, Dd, shade(roofCol, 0.9));
  occl.tris([b.x0, y0, b.z0, b.x0, y0, b.z1, b.x0, y0 + rise, cz], b.color);
  occl.tris([b.x1, y0, b.z0, b.x1, y0, b.z1, b.x1, y0 + rise, cz], b.color);
  // Windows with shutters.
  const shopFront = !!b.shop;
  for (let st = 0; st < b.storeys; st++) {
    const y = st * 2.9 + 1.55;
    const n = Math.max(2, Math.floor(W / 3.2));
    for (let i = 0; i < n; i++) {
      const x = b.x0 + (i + 0.5) * (W / n);
      if (st === 0 && Math.abs(x - b.doorX) < 1.4) continue;
      if (st === 0 && shopFront) continue;
      const wz = frontZ + fs * 0.03;
      glass.box(1.0, 1.3, 0.04, { x, y, z: wz }, 0xffffff);
      occl.box(1.0, 1.3, 0.02, { x, y, z: frontZ + fs * 0.005 }, 0x5d6d7e);
      occl.box(1.15, 0.08, 0.1, { x, y: y - 0.68, z: frontZ + fs * 0.05 }, 0xf5f0e6);
      occl.box(1.12, 0.06, 0.05, { x, y: y + 0.68, z: frontZ + fs * 0.03 }, 0xf5f0e6);
      for (const e of [-1, 1]) {
        occl.box(0.52, 1.36, 0.04, { x: x + e * 0.8, y, z: frontZ + fs * 0.04 }, b.shutter);
      }
      if (st === 1 && i % 2 === 0) {
        // Little balcony railing.
        occl.box(1.3, 0.05, 0.25, { x, y: y - 0.55, z: frontZ + fs * 0.15 }, 0x2d3436);
        for (let k = 0; k < 7; k++) occl.box(0.02, 0.45, 0.02, { x: x - 0.6 + k * 0.2, y: y - 0.3, z: frontZ + fs * 0.26 }, 0x2d3436);
        occl.box(1.3, 0.04, 0.04, { x, y: y - 0.08, z: frontZ + fs * 0.26 }, 0x2d3436);
      }
    }
  }
  // Door.
  occl.box(1.1, 2.2, 0.06, { x: b.doorX, y: 1.1, z: frontZ + fs * 0.03 }, b.door);
  occl.box(1.3, 0.12, 0.1, { x: b.doorX, y: 2.26, z: frontZ + fs * 0.05 }, 0xf5f0e6);
  occl.sphere(0.04, { x: b.doorX + 0.35, y: 1.05, z: frontZ + fs * 0.09 }, 0xd4af37);
  if (shopFront) {
    // Bakery: big display windows, sign.
    for (const x of [b.x0 + 2.6, b.x0 + 7.2]) {
      glass.box(3.4, 1.8, 0.04, { x, y: 1.35, z: frontZ + fs * 0.04 }, 0xffffff);
      occl.box(3.4, 1.8, 0.02, { x, y: 1.35, z: frontZ + fs * 0.01 }, 0x4a3b2f);
      occl.box(3.6, 0.12, 0.12, { x, y: 0.4, z: frontZ + fs * 0.06 }, 0x7a2d24);
      // Bread on display shelves.
      for (let k = 0; k < 6; k++) {
        occl.cylU(0.06, 0.55, { x: x - 1.2 + k * 0.48, y: 0.75, z: frontZ - fs * 0.2, rz: Math.PI / 2 }, 0xd9a35b, 8);
        occl.sphere(0.12, { x: x - 1.2 + k * 0.48, y: 1.05, z: frontZ - fs * 0.2, sy: 0.6 }, 0xe0a75e);
      }
    }
    const tex = textTexture('BOULANGERIE', { w: 1024, h: 160, bg: '#7a2d24', fg: '#f6e7c8', border: '#d4af37' });
    const sign = new THREE.Mesh(new THREE.PlaneGeometry(7.5, 1.1), mats.sign(tex));
    sign.position.set(b.x0 + W / 2 - 1, 3.2, frontZ + fs * 0.06);
    if (fs < 0) sign.rotation.y = Math.PI;
    root.add(sign);
    const tex2 = textTexture('Pain · Croissants · Gâteaux', { w: 1024, h: 120, bg: '#f4ebd6', fg: '#7a2d24', font: 'italic bold 60px Georgia, serif' });
    const sign2 = new THREE.Mesh(new THREE.PlaneGeometry(5, 0.55), mats.sign(tex2));
    sign2.position.set(b.x0 + W / 2 - 1, 2.55, frontZ + fs * 0.06);
    if (fs < 0) sign2.rotation.y = Math.PI;
    root.add(sign2);
  }
}

function buildPuddles(root: THREE.Group, mats: Materials) {
  for (const p of M.puddles) {
    const shape = new THREE.Shape();
    const n = 14;
    for (let i = 0; i <= n; i++) {
      const a = (i / n) * Math.PI * 2;
      const r = p.r * (0.85 + hash(i, Math.round(p.x)) * 0.3);
      const x = Math.cos(a) * r;
      const y = Math.sin(a) * r;
      if (i === 0) shape.moveTo(x, y);
      else shape.lineTo(x, y);
    }
    const g = new THREE.ShapeGeometry(shape);
    g.rotateX(-Math.PI / 2);
    const m = new THREE.Mesh(g, mats.mud);
    m.position.set(p.x, 0.025, p.z);
    m.receiveShadow = true;
    root.add(m);
    // Dark rim.
    const rim = new GeoBuilder();
    for (let i = 0; i < 10; i++) {
      const a = (i / 10) * Math.PI * 2;
      rim.ico(0.18, { x: p.x + Math.cos(a) * p.r * 1.02, y: 0.02, z: p.z + Math.sin(a) * p.r * 1.02, sy: 0.25 }, 0x6b4a32, 0.2);
    }
    root.add(rim.mesh(mats.vc, false));
  }
}

function buildBackdrop(occl: GeoBuilder, quality: string) {
  const B = M.bounds;
  const seedTrees: [number, number][] = [];
  // Gardens and houses beyond the south hedges.
  for (let x = -40; x <= 40; x += 6) {
    seedTrees.push([x + (hash(x, 1) - 0.5) * 3, B.z1 + 4 + hash(x, 2) * 6]);
  }
  for (let z = -10; z <= 25; z += 6) {
    seedTrees.push([B.x0 - 4 - hash(z, 3) * 5, z]);
    seedTrees.push([B.x1 + 3 + hash(z, 4) * 5, z + 2]);
  }
  for (let z = -34; z <= -12; z += 7) {
    seedTrees.push([B.x1 + 8 + hash(z, 5) * 4, z]);
    seedTrees.push([B.x0 - 8 - hash(z, 6) * 4, z]);
  }
  for (const [x, z] of seedTrees) {
    const r = 1.6 + hash(Math.round(x * 3), Math.round(z)) * 1.4;
    occl.cyl(0.2, 0.3, 2.4, { x, y: 1.2, z }, 0x7b5e45, 6);
    const leaf = leafColor(0x5c9a48, Math.round(x * 3 + z));
    occl.ico(r, { x, y: 2.6 + r * 0.6, z }, shade(leaf, 0.85 + hash(Math.round(x), Math.round(z)) * 0.3), 0.1);
    if (quality !== 'low') occl.ico(r * 0.7, { x: x + r * 0.4, y: 2.4 + r * 0.4, z: z - r * 0.3 }, shade(leafColor(0x5c9a48, Math.round(x * 3 + z) + 1), 0.95), 0.1);
  }
  // Distant houses (simple volumes) around the map.
  const cols = [0xe8d8c0, 0xf0dcc5, 0xe3cdb0, 0xefe2cc, 0xe9d6bf, 0xf2e3cf];
  const houses: [number, number, number, number, number][] = M.backdrop ?? [
    ...[-0.35, 0, 0.35].map((f, i): [number, number, number, number, number] => [(B.x0 + B.x1) / 2 + f * (B.x1 - B.x0), B.z1 + 12, 9, 7, cols[i]]),
    ...[-0.25, 0.25].map((f, i): [number, number, number, number, number] => [B.x1 + 12, (B.z0 + B.z1) / 2 + f * (B.z1 - B.z0), 7, 9, cols[3 + i]]),
    ...[-0.25, 0.25].map((f, i): [number, number, number, number, number] => [B.x0 - 12, (B.z0 + B.z1) / 2 + f * (B.z1 - B.z0), 7, 9, cols[i + 1]]),
  ];
  for (const [x, z, w, d, col] of houses) {
    const h = 5.4;
    occl.box(w, h, d, { x, y: h / 2, z }, col);
    const o = 0.3;
    const rise = 2.4;
    const snowy = season === 'hiver';
    occl.quad4([x - w / 2 - o, h, z - d / 2 - o], [x + w / 2 + o, h, z - d / 2 - o], [x + w / 2 + o, h + rise, z], [x - w / 2 - o, h + rise, z], snowy ? 0xeef2f6 : 0xbf5d36);
    occl.quad4([x - w / 2 - o, h, z + d / 2 + o], [x + w / 2 + o, h, z + d / 2 + o], [x + w / 2 + o, h + rise, z], [x - w / 2 - o, h + rise, z], snowy ? 0xe2e9f0 : 0xb05532);
    occl.tris([x - w / 2, h, z - d / 2, x - w / 2, h, z + d / 2, x - w / 2, h + rise, z], col);
    occl.tris([x + w / 2, h, z - d / 2, x + w / 2, h, z + d / 2, x + w / 2, h + rise, z], col);
    for (let i = 0; i < 3; i++) {
      for (const s of [-1, 1]) occl.box(0.9, 1.1, 0.05, { x: x - w / 3 + i * (w / 3), y: 3.6, z: z + s * (d / 2 + 0.02) }, 0x6b7c8f);
    }
  }
  // Hedge/fence lines beyond the boundary (visual only).
  occl.box(80, 1.6, 0.8, { x: 0, y: 0.8, z: B.z1 + 12 }, leafColor(0x4f8f3e), 0.15);
}
