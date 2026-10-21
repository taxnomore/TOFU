// Low-poly models for interactable items and mess decals.
import * as THREE from 'three';
import type { MessKind } from '../../shared/world/itemTypes';
import { GeoBuilder, hash } from './geo';

type ItemBuilder = (b: GeoBuilder, seed: number) => void;

function stripes(b: GeoBuilder, w: number, h: number, d: number, y: number, n: number, c1: number, c2: number) {
  for (let i = 0; i < n; i++) b.box(w, h / n, d, { y: y - h / 2 + (i + 0.5) * (h / n) }, i % 2 ? c1 : c2);
}

const ITEMS: Record<string, ItemBuilder> = {
  toilet_roll(b) {
    b.cylU(0.06, 0.11, { y: 0.06, rz: Math.PI / 2 }, 0xfafafa, 14);
    b.cylU(0.022, 0.112, { y: 0.06, rz: Math.PI / 2 }, 0xc8a46e, 10);
    // A loose sheet.
    b.box(0.1, 0.004, 0.14, { y: 0.004, z: 0.08 }, 0xffffff);
  },
  sock(b) {
    b.rbox(0.09, 0.2, 0.05, 0.03, { y: 0.1 }, 0xe74c3c);
    b.rbox(0.09, 0.07, 0.15, 0.03, { y: 0.035, z: 0.05 }, 0xe74c3c);
    b.rbox(0.092, 0.05, 0.052, 0.02, { y: 0.19 }, 0xffffff);
    b.sphere(0.035, { y: 0.035, z: 0.12 }, 0xffffff, 'lo');
  },
  sock2(b) {
    for (let i = 0; i < 4; i++) b.rbox(0.09, 0.05, 0.05, 0.02, { y: 0.03 + i * 0.05 }, i % 2 ? 0xffffff : 0x2e86de);
    b.rbox(0.09, 0.07, 0.14, 0.03, { y: 0.035, z: 0.05 }, 0x2e86de);
  },
  underwear(b) {
    b.rbox(0.26, 0.12, 0.05, 0.03, { y: 0.1 }, 0xffffff);
    b.rbox(0.1, 0.12, 0.05, 0.03, { y: 0.03 }, 0xffffff);
    for (let i = 0; i < 7; i++) b.sphere(0.018, { x: -0.1 + (i % 4) * 0.065, y: 0.07 + Math.floor(i / 4) * 0.06, z: 0.026, sz: 0.4 }, 0xe74c3c, 'lo');
  },
  tshirt(b) {
    stripes(b, 0.3, 0.3, 0.03, 0.15, 7, 0xffffff, 0x1f3a93);
    b.box(0.12, 0.1, 0.03, { x: -0.19, y: 0.25, rz: 0.5 }, 0x1f3a93);
    b.box(0.12, 0.1, 0.03, { x: 0.19, y: 0.25, rz: -0.5 }, 0x1f3a93);
  },
  towel(b) {
    b.rbox(0.3, 0.32, 0.04, 0.02, { y: 0.16 }, 0xff8fab);
    b.box(0.3, 0.04, 0.045, { y: 0.06 }, 0xffffff);
    b.box(0.3, 0.04, 0.045, { y: 0.26 }, 0xffffff);
  },
  slipper(b) {
    b.rbox(0.11, 0.07, 0.24, 0.035, { y: 0.035 }, 0x9b59b6);
    b.rbox(0.1, 0.05, 0.12, 0.025, { y: 0.075, z: 0.04 }, 0xb57edc);
    b.sphere(0.04, { y: 0.11, z: 0.08 }, 0xffffff);
  },
  teddy(b) {
    b.sphere(0.1, { y: 0.1, sy: 1.1 }, 0xb07a4a);
    b.sphere(0.075, { y: 0.24 }, 0xb07a4a);
    for (const s of [-1, 1]) {
      b.sphere(0.03, { x: s * 0.06, y: 0.31 }, 0xb07a4a, 'lo');
      b.sphere(0.035, { x: s * 0.09, y: 0.12, z: 0.03 }, 0xb07a4a, 'lo');
      b.sphere(0.012, { x: s * 0.028, y: 0.26, z: 0.065 }, 0x1e1712, 'lo');
    }
    b.sphere(0.03, { y: 0.22, z: 0.065 }, 0xe8c8a0, 'lo');
    b.box(0.08, 0.025, 0.02, { y: 0.17, z: 0.07 }, 0xe74c3c);
  },
  toycar(b) {
    b.rbox(0.14, 0.06, 0.24, 0.02, { y: 0.05 }, 0xe74c3c);
    b.rbox(0.12, 0.06, 0.12, 0.02, { y: 0.1, z: -0.02 }, 0x74b9ff);
    for (const s of [-1, 1]) for (const t of [-1, 1]) b.cylU(0.03, 0.03, { x: s * 0.07, y: 0.03, z: t * 0.07, rz: Math.PI / 2 }, 0x2d3436, 8);
  },
  duck(b) {
    b.sphere(0.08, { y: 0.07, sz: 1.3, sy: 0.8 }, 0xf9ca24);
    b.sphere(0.055, { y: 0.15, z: 0.06 }, 0xf9ca24);
    b.cone(0.022, 0.05, { y: 0.145, z: 0.12, rx: Math.PI / 2 }, 0xf0932b);
    b.sphere(0.01, { x: 0.025, y: 0.17, z: 0.1 }, 0x1e1712, 'lo');
    b.sphere(0.01, { x: -0.025, y: 0.17, z: 0.1 }, 0x1e1712, 'lo');
  },
  dino(b) {
    b.sphere(0.08, { y: 0.09, sz: 1.5 }, 0x6ab04c);
    b.sphere(0.05, { y: 0.16, z: 0.13 }, 0x6ab04c);
    b.cone(0.03, 0.14, { y: 0.07, z: -0.16, rx: -Math.PI / 2 - 0.3 }, 0x6ab04c);
    for (let i = 0; i < 4; i++) b.cone(0.02, 0.05, { y: 0.17, z: 0.05 - i * 0.05 }, 0xf9ca24);
    for (const s of [-1, 1]) for (const t of [-1, 1]) b.cylU(0.02, 0.06, { x: s * 0.04, y: 0.03, z: t * 0.05 }, 0x6ab04c, 8);
  },
  croissants(b) {
    b.rbox(0.22, 0.2, 0.12, 0.02, { y: 0.1 }, 0xe8d3a8);
    b.box(0.222, 0.05, 0.122, { y: 0.17 }, 0xc0392b);
    for (const s of [-1, 1]) {
      b.torus(0.06, 0.03, { x: s * 0.05, y: 0.22, rx: Math.PI / 2, rz: s * 0.4, sy: 0.7 }, 0xd99a3e);
    }
  },
  baguette(b) {
    b.cylU(0.035, 0.6, { y: 0.04, rx: Math.PI / 2 }, 0xd9a35b, 10);
    b.sphere(0.035, { y: 0.04, z: 0.3 }, 0xd9a35b);
    b.sphere(0.035, { y: 0.04, z: -0.3 }, 0xd9a35b);
    for (let i = 0; i < 5; i++) b.box(0.03, 0.012, 0.05, { y: 0.07, z: -0.2 + i * 0.1, ry: 0.5 }, 0xf3d7a2);
    b.box(0.08, 0.05, 0.14, { y: 0.04, z: 0.05 }, 0xf5f0e6);
  },
  letter(b) {
    b.box(0.24, 0.015, 0.16, { y: 0.01 }, 0xffffff);
    b.box(0.05, 0.017, 0.04, { x: 0.08, y: 0.011, z: -0.05 }, 0xe74c3c);
    b.box(0.22, 0.016, 0.01, { y: 0.012, z: 0.0, ry: 0.55 }, 0xdfe6e9);
    b.box(0.22, 0.016, 0.01, { y: 0.012, z: 0.0, ry: -0.55 }, 0xdfe6e9);
  },
  trash_bag(b) {
    b.ico(0.22, { y: 0.2, sy: 1.1 }, 0x2d3436, 0.15);
    b.cone(0.06, 0.12, { y: 0.44 }, 0x2d3436);
    b.box(0.08, 0.02, 0.02, { y: 0.43 }, 0xf1c40f);
  },
  dishes(b) {
    for (let i = 0; i < 4; i++) {
      b.cylU(0.13, 0.02, { y: 0.02 + i * 0.024 }, 0xffffff, 16);
      b.cylU(0.135, 0.008, { y: 0.03 + i * 0.024 }, 0x2e86de, 16);
    }
    b.box(0.02, 0.01, 0.18, { x: 0.17, y: 0.1, ry: 0.2 }, 0xb2bec3);
    b.box(0.02, 0.01, 0.18, { x: 0.2, y: 0.1, ry: 0.25 }, 0xb2bec3);
  },
  ball(b) {
    b.sphere(0.065, { y: 0.065 }, 0xd4e157, 'hi');
    b.torus(0.062, 0.008, { y: 0.065, rx: 0.6 }, 0xffffff);
  },
  watering_can(b) {
    b.cyl(0.11, 0.13, 0.24, { y: 0.12 }, 0x27ae60, 12);
    b.cylU(0.02, 0.3, { y: 0.15, z: 0.17, rx: 0.9 }, 0x27ae60, 8);
    b.cyl(0.04, 0.025, 0.05, { y: 0.27, z: 0.29, rx: 0.9 }, 0x229954, 8);
    b.torus(0.08, 0.015, { y: 0.27, z: -0.05, ry: Math.PI / 2 }, 0x229954);
  },
  vase(b) {
    b.cyl(0.07, 0.09, 0.22, { y: 0.11 }, 0x2e86de, 12);
    b.cyl(0.05, 0.07, 0.06, { y: 0.25 }, 0x2e86de, 12);
    for (let i = 0; i < 5; i++) {
      const a = (i / 5) * Math.PI * 2;
      b.cylU(0.008, 0.2, { x: Math.cos(a) * 0.03, y: 0.36, z: Math.sin(a) * 0.03, rz: Math.cos(a) * 0.2, rx: Math.sin(a) * 0.2 }, 0x4f8f3a, 6);
      b.ico(0.035, { x: Math.cos(a) * 0.06, y: 0.46, z: Math.sin(a) * 0.06 }, [0xff6b81, 0xfeca57, 0xffffff, 0xff9ff3, 0xe74c3c][i]);
    }
  },
  plant(b, seed) {
    b.cyl(0.2, 0.15, 0.32, { y: 0.16 }, 0xc0703f, 12);
    b.cylU(0.21, 0.04, { y: 0.32 }, 0xa85f33, 12);
    for (let i = 0; i < 8; i++) {
      const a = (i / 8) * Math.PI * 2 + hash(i, seed) * 0.5;
      const tilt = 0.5 + hash(i + 9, seed) * 0.5;
      b.sphere(0.5, { x: Math.cos(a) * 0.14, y: 0.55 + hash(i + 3, seed) * 0.2, z: Math.sin(a) * 0.14, sx: 0.12, sy: 0.4, sz: 0.04, ry: -a + Math.PI / 2, rz: Math.cos(a) * tilt, rx: Math.sin(a) * tilt }, i % 2 ? 0x3d8b3d : 0x52a352);
    }
  },
  flowerpot(b, seed) {
    b.cyl(0.16, 0.12, 0.24, { y: 0.12 }, 0xd35400, 12);
    b.cylU(0.17, 0.035, { y: 0.24 }, 0xba4a00, 12);
    for (let i = 0; i < 6; i++) {
      const a = (i / 6) * Math.PI * 2;
      b.cylU(0.008, 0.14, { x: Math.cos(a) * 0.06, y: 0.31, z: Math.sin(a) * 0.06 }, 0x4f8f3a, 6);
      b.ico(0.04, { x: Math.cos(a) * 0.07, y: 0.39, z: Math.sin(a) * 0.07 }, [0xe74c3c, 0xfeca57, 0xff9ff3][(i + seed) % 3]);
    }
  },
  toy_tower(b) {
    const cols = [0xe74c3c, 0x3498db, 0xf1c40f, 0x2ecc71, 0x9b59b6, 0xe67e22];
    for (let i = 0; i < 6; i++) b.rbox(0.12, 0.11, 0.12, 0.015, { y: 0.055 + i * 0.112, ry: i * 0.3 }, cols[i]);
  },
  cushion(b, seed) {
    const col = [0xf9ca24, 0xff7f6e, 0x55efc4][seed % 3];
    b.rbox(0.42, 0.14, 0.42, 0.06, { y: 0.07 }, col);
    b.sphere(0.03, { y: 0.14 }, 0xffffff, 'lo');
  },
  kitchen_bin(b) {
    b.cyl(0.18, 0.16, 0.55, { y: 0.275 }, 0xbdc3c7, 14);
    b.cyl(0.19, 0.19, 0.06, { y: 0.58 }, 0x95a5a6, 14);
    b.box(0.08, 0.02, 0.06, { y: 0.02, z: 0.18 }, 0x7f8c8d);
  },
  wheelie_bin(b, seed) {
    const lid = seed % 2 ? 0xf1c40f : 0x27ae60;
    b.rbox(0.58, 0.9, 0.62, 0.05, { y: 0.5 }, 0x3f4a54);
    b.rbox(0.62, 0.07, 0.68, 0.03, { y: 0.97, z: 0.02 }, lid);
    b.box(0.5, 0.04, 0.05, { y: 0.92, z: -0.33 }, 0x2d3436);
    for (const s of [-1, 1]) b.cylU(0.09, 0.06, { x: s * 0.28, y: 0.09, z: -0.26, rz: Math.PI / 2 }, 0x1e272e, 10);
  },
  public_bin(b) {
    b.cylU(0.05, 0.8, { y: 0.4 }, 0x2f5d50, 8);
    b.cyl(0.24, 0.2, 0.5, { y: 0.62 }, 0x2f5d50, 12);
    b.torus(0.24, 0.02, { y: 0.87, rx: Math.PI / 2 }, 0x2f5d50);
  },
  gnome(b) {
    b.cyl(0.11, 0.13, 0.22, { y: 0.11 }, 0x2e86de, 12);
    b.sphere(0.08, { y: 0.28 }, 0xf2c6a0);
    b.cone(0.09, 0.22, { y: 0.44 }, 0xe74c3c, 12);
    b.sphere(0.07, { y: 0.24, z: 0.05, sy: 1.3 }, 0xffffff);
    b.sphere(0.025, { y: 0.3, z: 0.075 }, 0xe8a0a0, 'lo');
    b.box(0.2, 0.04, 0.2, { y: 0.02 }, 0x7f8c8d);
  },
  watering_pot(b) {
    b.cyl(0.13, 0.1, 0.24, { y: 0.12 }, 0x3498db, 12);
    b.torus(0.12, 0.01, { y: 0.25, rx: Math.PI / 2 }, 0x2980b9);
    b.cylU(0.12, 0.02, { y: 0.22 }, 0x74b9ff, 12);
  },
};

export function buildItemGeometry(type: string, seed = 0): THREE.BufferGeometry {
  const b = new GeoBuilder();
  (ITEMS[type] ?? ITEMS.sock)(b, seed);
  return b.build();
}

/** "Set table" visual for the dishes item stored at the dining table. */
export function buildSetTableGeometry(): THREE.BufferGeometry {
  const b = new GeoBuilder();
  const places: [number, number, number][] = [[-0.55, -0.32, 0], [0.55, -0.32, 0], [-0.55, 0.32, Math.PI], [0.55, 0.32, Math.PI]];
  for (const [x, z] of places) {
    b.cylU(0.13, 0.015, { x, y: 0.008, z }, 0xffffff, 16);
    b.cylU(0.135, 0.006, { x, y: 0.014, z }, 0x2e86de, 16);
    b.box(0.015, 0.008, 0.16, { x: x - 0.18, y: 0.005, z }, 0xb2bec3);
    b.box(0.015, 0.008, 0.16, { x: x + 0.18, y: 0.005, z }, 0xb2bec3);
    b.cyl(0.035, 0.03, 0.1, { x: x + 0.15, y: 0.05, z: z + (z < 0 ? 0.12 : -0.12) }, 0xdff9fb, 10);
  }
  b.cyl(0.12, 0.09, 0.1, { y: 0.05 }, 0xfab1a0, 12);
  b.ico(0.08, { y: 0.13 }, 0xe74c3c);
  return b.build();
}

/** Visual decal for a mess (positioned at the mess center). */
export function buildMessGeometry(kind: MessKind, seed: number, r: number): THREE.BufferGeometry | null {
  const b = new GeoBuilder();
  const rnd = (i: number) => hash(i, seed);
  switch (kind) {
    case 'soil': {
      blob(b, r * 0.75, 0x5d4030, seed, 0.012);
      for (let i = 0; i < 14; i++) {
        const a = rnd(i) * Math.PI * 2;
        const d = rnd(i + 20) * r * 0.9;
        b.ico(0.05 + rnd(i + 40) * 0.05, { x: Math.cos(a) * d, y: 0.02, z: Math.sin(a) * d, sy: 0.5 }, 0x4a3326);
      }
      for (let i = 0; i < 4; i++) b.box(0.12, 0.03, 0.08, { x: (rnd(i + 70) - 0.5) * r, y: 0.02, z: (rnd(i + 80) - 0.5) * r, ry: rnd(i + 90) * 3 }, 0xd35400);
      break;
    }
    case 'blocks': {
      const cols = [0xe74c3c, 0x3498db, 0xf1c40f, 0x2ecc71, 0x9b59b6, 0xe67e22];
      for (let i = 0; i < 9; i++) {
        const a = rnd(i) * Math.PI * 2;
        const d = 0.2 + rnd(i + 20) * r * 0.9;
        b.rbox(0.12, 0.11, 0.12, 0.015, { x: Math.cos(a) * d, y: 0.055, z: Math.sin(a) * d, ry: rnd(i + 5) * 3, rz: rnd(i + 6) > 0.6 ? Math.PI / 2 : 0 }, cols[i % cols.length]);
      }
      break;
    }
    case 'trash': {
      blob(b, r * 0.6, 0x7a6a55, seed, 0.01);
      for (let i = 0; i < 12; i++) {
        const a = rnd(i) * Math.PI * 2;
        const d = 0.15 + rnd(i + 20) * r * 0.9;
        const x = Math.cos(a) * d;
        const z = Math.sin(a) * d;
        const k = i % 4;
        if (k === 0) b.ico(0.06, { x, y: 0.05, z }, 0xf5f6fa, 0.3); // paper
        else if (k === 1) b.cylU(0.035, 0.11, { x, y: 0.035, z, rz: Math.PI / 2, ry: rnd(i + 3) * 3 }, 0xe74c3c, 8); // can
        else if (k === 2) {
          b.box(0.16, 0.025, 0.04, { x, y: 0.015, z, ry: rnd(i + 4) * 3 }, 0xf9ca24); // banana peel
          b.box(0.1, 0.02, 0.035, { x: x + 0.05, y: 0.015, z: z + 0.05, ry: rnd(i + 4) * 3 + 0.8 }, 0xf9ca24);
        } else b.sphere(0.04, { x, y: 0.04, z }, 0xc8d6a0, 'lo'); // apple core
      }
      break;
    }
    case 'water': {
      // Drawn with the water material separately (see waterGeometry); petals here.
      const cols = [0xff6b81, 0xfeca57, 0xffffff, 0xff9ff3];
      for (let i = 0; i < 8; i++) {
        const a = rnd(i) * Math.PI * 2;
        const d = rnd(i + 20) * r * 0.8;
        b.ico(0.03, { x: Math.cos(a) * d, y: 0.015, z: Math.sin(a) * d, sy: 0.4 }, cols[i % cols.length]);
      }
      b.cylU(0.008, 0.25, { x: 0.1, y: 0.01, z: -0.05, rz: Math.PI / 2, ry: rnd(3) * 3 }, 0x4f8f3a, 6);
      break;
    }
    case 'crumbs': {
      for (let i = 0; i < 22; i++) {
        const a = rnd(i) * Math.PI * 2;
        const d = rnd(i + 20) * r * 0.85;
        b.ico(0.018 + rnd(i + 3) * 0.02, { x: Math.cos(a) * d, y: 0.012, z: Math.sin(a) * d }, i % 3 ? 0xe0b06a : 0xc98a3e);
      }
      b.box(0.2, 0.01, 0.12, { x: 0.15, y: 0.01, z: -0.1, ry: 0.4 }, 0xe8d3a8);
      break;
    }
    case 'shards': {
      for (let i = 0; i < 14; i++) {
        const a = rnd(i) * Math.PI * 2;
        const d = rnd(i + 20) * r * 0.9;
        const x = Math.cos(a) * d;
        const z = Math.sin(a) * d;
        b.tris([x, 0.02, z, x + 0.1, 0.02, z + 0.03, x + 0.03, 0.02, z + 0.11], i % 3 ? 0xffffff : 0x2e86de);
      }
      for (let i = 0; i < 3; i++) b.box(0.02, 0.01, 0.18, { x: (rnd(i + 50) - 0.5) * r, y: 0.01, z: (rnd(i + 60) - 0.5) * r, ry: rnd(i + 70) * 3 }, 0xb2bec3);
      break;
    }
    case 'dig': {
      b.disc(0.32, { y: 0.03 }, 0x2b1d14, 14);
      for (let i = 0; i < 10; i++) {
        const a = rnd(i) * Math.PI * 2;
        const d = 0.35 + rnd(i + 20) * 0.35;
        b.ico(0.09 + rnd(i + 40) * 0.07, { x: Math.cos(a) * d, y: 0.05, z: Math.sin(a) * d, sy: 0.55 }, 0x6b4a32, 0.2);
      }
      b.cylU(0.01, 0.2, { x: 0.45, y: 0.04, z: 0.1, rz: Math.PI / 2 }, 0x4f8f3a, 6);
      b.ico(0.05, { x: 0.55, y: 0.05, z: 0.1 }, 0xe74c3c);
      break;
    }
    case 'muddy_bed':
    case 'muddy_sofa': {
      for (let i = 0; i < 9; i++) {
        const x = (rnd(i) - 0.5) * (kind === 'muddy_bed' ? 1.5 : 0.7);
        const z = (rnd(i + 30) - 0.5) * (kind === 'muddy_bed' ? 1.3 : 1.7);
        b.disc(0.06 + rnd(i + 60) * 0.06, { x, y: 0.0, z }, 0x6b4a32, 10);
      }
      break;
    }
    default:
      return null;
  }
  return b.empty ? null : b.build();
}

function blob(b: GeoBuilder, r: number, color: number, seed: number, y: number) {
  const n = 12;
  for (let i = 0; i < n; i++) {
    const a0 = (i / n) * Math.PI * 2;
    const a1 = ((i + 1) / n) * Math.PI * 2;
    const r0 = r * (0.7 + hash(i, seed) * 0.5);
    const r1 = r * (0.7 + hash((i + 1) % n, seed) * 0.5);
    b.tris([0, y, 0, Math.cos(a1) * r1, y, Math.sin(a1) * r1, Math.cos(a0) * r0, y, Math.sin(a0) * r0], color, false);
  }
}

/** Irregular flat water puddle geometry (for the transparent water material). */
export function waterGeometry(r: number, seed: number): THREE.BufferGeometry {
  const shape = new THREE.Shape();
  const n = 12;
  for (let i = 0; i <= n; i++) {
    const a = (i / n) * Math.PI * 2;
    const rr = r * (0.65 + hash(i % n, seed) * 0.45);
    if (i === 0) shape.moveTo(Math.cos(a) * rr, Math.sin(a) * rr);
    else shape.lineTo(Math.cos(a) * rr, Math.sin(a) * rr);
  }
  const g = new THREE.ShapeGeometry(shape);
  g.rotateX(-Math.PI / 2);
  return g;
}

/** Treat (small dog biscuit bone). */
export function treatGeometry(): THREE.BufferGeometry {
  const b = new GeoBuilder();
  b.cylU(0.025, 0.12, { y: 0.03, rz: Math.PI / 2 }, 0xc98a3e, 8);
  for (const s of [-1, 1]) for (const t of [-1, 1]) b.sphere(0.025, { x: s * 0.065, y: 0.03, z: t * 0.02 }, 0xc98a3e, 'lo');
  return b.build();
}
