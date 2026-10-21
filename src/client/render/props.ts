// Procedural low-poly models for static props. Each builder works in local
// space (origin on the floor at the prop center, front facing +z) and the
// result is transformed into world space and merged by the world builder.
import * as THREE from 'three';
import { PROP_TYPES, propExtents } from '../../shared/world/propTypes';
import type { PropDef, PropType } from '../../shared/world/types';
import { ColorLike, GeoBuilder, hash, shade } from './geo';

export interface PropCtx {
  /** Opaque, never cut. */
  b: GeoBuilder;
  /** See-through occluder (tall things). */
  c: GeoBuilder;
  p: PropDef;
  w: number;
  d: number;
  h: number;
}

const WOOD = 0xa9764d;
const WOOD_DARK = 0x7a5235;
const WOOD_LIGHT = 0xd9b48a;
const WHITE = 0xf3f0ea;
const METAL = 0x4b5563;
const GREEN_IRON = 0x2f5d50;

function legs4(b: GeoBuilder, w: number, d: number, h: number, r: number, inset: number, color: ColorLike) {
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) {
    b.cylU(r, h, { x: sx * (w / 2 - inset), y: h / 2, z: sz * (d / 2 - inset) }, color, 8);
  }
}

function books(b: GeoBuilder, x0: number, x1: number, y: number, z: number, depth: number, seed: number) {
  let x = x0;
  let i = 0;
  const cols = [0xc0392b, 0x2e86c1, 0xf1c40f, 0x27ae60, 0x8e44ad, 0xe67e22, 0x16a085, 0xecf0f1];
  while (x < x1 - 0.04) {
    const bw = 0.03 + hash(i, seed) * 0.04;
    const bh = 0.18 + hash(i + 50, seed) * 0.12;
    if (hash(i + 99, seed) > 0.85) {
      x += bw + 0.05;
      i++;
      continue;
    }
    b.box(bw, bh, depth, { x: x + bw / 2, y: y + bh / 2, z }, cols[Math.floor(hash(i + 7, seed) * cols.length)]);
    x += bw + 0.004;
    i++;
  }
}

function lamp(b: GeoBuilder, x: number, y: number, z: number, shadeColor = 0xf6e3b4) {
  b.cylU(0.07, 0.03, { x, y: y + 0.015, z }, 0x8c7b6b, 8);
  b.cylU(0.012, 0.25, { x, y: y + 0.14, z }, 0x8c7b6b, 8);
  b.cyl(0.07, 0.11, 0.14, { x, y: y + 0.3, z }, shadeColor, 10);
}

function foliage(b: GeoBuilder, cx: number, cy: number, cz: number, r: number, base: number, seed: number, n = 6) {
  for (let i = 0; i < n; i++) {
    const a = hash(i, seed) * Math.PI * 2;
    const rr = r * (0.35 + hash(i + 10, seed) * 0.45);
    const k = 0.82 + hash(i + 20, seed) * 0.32;
    b.ico(r * (0.5 + hash(i + 30, seed) * 0.35), {
      x: cx + Math.cos(a) * rr, y: cy + (hash(i + 40, seed) - 0.3) * r * 0.7, z: cz + Math.sin(a) * rr,
      ry: hash(i + 60, seed) * 3,
    }, shade(base, k), 0.12);
  }
  b.ico(r * 0.75, { x: cx, y: cy + r * 0.25, z: cz }, shade(base, 1.08), 0.12);
}

function flowers(b: GeoBuilder, x0: number, z0: number, x1: number, z1: number, y: number, seed: number, density = 18) {
  const cols = [0xe74c3c, 0xf5b7b1, 0xf7dc6f, 0xffffff, 0xaf7ac5, 0xf0932b, 0xff8fab];
  const n = Math.max(3, Math.floor((x1 - x0) * (z1 - z0) * density));
  for (let i = 0; i < n; i++) {
    const x = x0 + hash(i, seed) * (x1 - x0);
    const z = z0 + hash(i + 300, seed) * (z1 - z0);
    const hh = 0.12 + hash(i + 600, seed) * 0.2;
    b.cylU(0.012, hh, { x, y: y + hh / 2, z }, 0x4f8f3a, 8);
    b.ico(0.05 + hash(i + 900, seed) * 0.03, { x, y: y + hh, z }, cols[Math.floor(hash(i + 1200, seed) * cols.length)]);
    if (i % 2 === 0) b.ico(0.06, { x: x + 0.04, y: y + hh * 0.4, z: z + 0.03, sy: 0.5 }, 0x5aa547);
  }
}

type Builder = (x: PropCtx) => void;

const B: Partial<Record<PropType, Builder>> = {
  bed_double({ b, p, w, d }) {
    const wood = p.color2 ?? WOOD;
    b.rbox(w, 0.28, d, 0.04, { y: 0.17 }, wood);
    b.rbox(w - 0.08, 0.2, d - 0.12, 0.06, { y: 0.4, z: 0.03 }, WHITE);
    b.rbox(w + 0.04, 1.0, 0.1, 0.04, { y: 0.5, z: -d / 2 + 0.05 }, wood);
    b.rbox(w + 0.04, 0.14, 0.06, 0.03, { y: 1.02, z: -d / 2 + 0.05 }, shade(wood, 0.85));
    b.rbox(w + 0.02, 0.45, 0.08, 0.03, { y: 0.32, z: d / 2 - 0.02 }, wood);
    for (const sx of [-1, 1]) b.rbox(0.68, 0.15, 0.4, 0.07, { x: sx * 0.42, y: 0.56, z: -d / 2 + 0.36 }, 0xfbf7ef);
  },
  bed_single({ b, p, w, d }) {
    const wood = p.color2 ?? 0xf2c14e;
    b.rbox(w, 0.26, d, 0.04, { y: 0.16 }, wood);
    b.rbox(w - 0.08, 0.18, d - 0.12, 0.05, { y: 0.37, z: 0.03 }, WHITE);
    b.rbox(w + 0.04, 0.85, 0.1, 0.04, { y: 0.43, z: -d / 2 + 0.05 }, wood);
    b.rbox(w + 0.04, 0.6, 0.08, 0.03, { y: 0.3, z: d / 2 - 0.02 }, wood);
    b.rbox(0.6, 0.13, 0.36, 0.06, { y: 0.52, z: -d / 2 + 0.32 }, 0xfbf7ef);
    // Stars on the headboard.
    for (let i = 0; i < 3; i++) b.cylU(0.05, 0.02, { x: -0.3 + i * 0.3, y: 0.68, z: -d / 2 + 0.11, rx: Math.PI / 2 }, 0xfff3b0, 8);
  },
  nightstand({ b, w, d, h }) {
    b.rbox(w, h - 0.06, d, 0.03, { y: (h - 0.06) / 2 + 0.06 }, WOOD_LIGHT);
    legs4(b, w, d, 0.08, 0.02, 0.05, WOOD_DARK);
    b.box(w - 0.08, 0.14, 0.01, { y: h - 0.15, z: d / 2 + 0.002 }, shade(WOOD_LIGHT, 0.9));
    b.sphere(0.02, { y: h - 0.15, z: d / 2 + 0.02 }, 0xd4af37);
    lamp(b, 0, h, 0);
  },
  wardrobe({ c, w, d, h }) {
    c.rbox(w, h - 0.1, d, 0.03, { y: (h - 0.1) / 2 + 0.1 }, 0xe8d8c2);
    c.box(w + 0.06, 0.08, d + 0.04, { y: h - 0.02 }, 0xd8c3a5);
    c.box(w - 0.04, 0.1, d - 0.04, { y: 0.05 }, 0xbfa889);
    c.box(0.012, h - 0.3, 0.01, { y: h / 2 + 0.05, z: d / 2 + 0.003 }, 0xb59d80);
    for (const sx of [-1, 1]) {
      c.box(w / 2 - 0.12, h - 0.45, 0.01, { x: sx * w / 4, y: h / 2 + 0.05, z: d / 2 + 0.004 }, 0xf1e5d3);
      c.sphere(0.025, { x: sx * 0.07, y: h / 2, z: d / 2 + 0.02 }, 0xc9a227);
    }
    // Suitcase on top.
    c.rbox(0.6, 0.22, 0.4, 0.04, { x: -0.3, y: h + 0.11 }, 0x5d8aa8);
  },
  dresser({ b, w, d, h }) {
    b.rbox(w, h - 0.08, d, 0.03, { y: (h - 0.08) / 2 + 0.08 }, 0x9fc5b4);
    legs4(b, w, d, 0.1, 0.022, 0.06, WOOD_DARK);
    b.box(w + 0.04, 0.04, d + 0.02, { y: h }, WOOD_LIGHT);
    for (let i = 0; i < 3; i++) {
      const y = 0.25 + i * 0.22;
      b.box(w - 0.1, 0.17, 0.012, { y, z: d / 2 + 0.002 }, 0xb7d6c8);
      for (const sx of [-1, 1]) b.sphere(0.022, { x: sx * w * 0.25, y, z: d / 2 + 0.02 }, 0xf0e2b6);
    }
    // A sock dangling from the top drawer (Tofu's favourite).
    b.rbox(0.07, 0.16, 0.02, 0.02, { x: w * 0.2, y: 0.62, z: d / 2 + 0.03, rz: 0.2 }, 0xe74c3c);
    // Mirror and jewelry box.
    b.box(0.5, 0.42, 0.03, { y: h + 0.25, z: -d / 2 + 0.04 }, 0xd4af37);
    b.box(0.42, 0.34, 0.02, { y: h + 0.25, z: -d / 2 + 0.06 }, 0xcfe7f2);
    b.rbox(0.2, 0.1, 0.12, 0.02, { x: -w * 0.3, y: h + 0.07 }, 0xc0392b);
  },
  desk({ b, w, d, h }) {
    b.rbox(w, 0.04, d, 0.015, { y: h - 0.02 }, 0xf7f3ea);
    legs4(b, w, d, h - 0.04, 0.025, 0.05, 0x5dade2);
    b.box(0.35, 0.18, d - 0.06, { x: w / 2 - 0.22, y: h - 0.14 }, 0x5dade2);
    lamp(b, -w / 2 + 0.15, h, -d / 2 + 0.14, 0xff7675);
    books(b, 0.05, 0.3, h, -d / 2 + 0.12, 0.18, 77);
    b.box(0.3, 0.005, 0.22, { x: -0.05, y: h + 0.003, z: 0.06, ry: 0.2 }, 0xffffff);
    b.cylU(0.03, 0.09, { x: 0.38, y: h + 0.045, z: 0.12 }, 0xf39c12, 8);
  },
  bookshelf({ b, c, p, w, d, h }) {
    const t = PROP_TYPES[p.type].tall ? c : b;
    const col = p.color ?? WOOD_LIGHT;
    t.box(w, h, 0.03, { y: h / 2, z: -d / 2 + 0.015 }, shade(col, 0.85));
    t.box(0.04, h, d, { x: -w / 2 + 0.02, y: h / 2 }, col);
    t.box(0.04, h, d, { x: w / 2 - 0.02, y: h / 2 }, col);
    const shelves = Math.max(2, Math.round(h / 0.38));
    for (let i = 0; i <= shelves; i++) {
      const y = 0.03 + (i * (h - 0.06)) / shelves;
      t.box(w - 0.06, 0.03, d, { y }, col);
      if (i < shelves) books(t, -w / 2 + 0.05, w / 2 - 0.05, y + 0.015, 0.0, d * 0.8, i * 13 + Math.round(p.x * 10));
    }
  },
  bookshelf_low({ b, w, d, h }) {
    b.rbox(w, h, d, 0.02, { y: h / 2 }, WOOD_LIGHT);
    books(b, -w / 2 + 0.05, w / 2 - 0.05, h, 0, d * 0.8, 5);
  },
  console({ b, w, d, h }) {
    b.rbox(w, 0.05, d, 0.015, { y: h - 0.025 }, WOOD);
    for (const sx of [-1, 1]) {
      b.box(0.04, h - 0.05, 0.04, { x: sx * (w / 2 - 0.05), y: (h - 0.05) / 2, z: d / 2 - 0.06 }, WOOD_DARK);
      b.box(0.04, h - 0.05, 0.04, { x: sx * (w / 2 - 0.05), y: (h - 0.05) / 2, z: -d / 2 + 0.06 }, WOOD_DARK);
    }
    b.box(w - 0.1, 0.03, d - 0.06, { y: 0.2 }, WOOD);
    b.cyl(0.11, 0.07, 0.05, { x: w * 0.3, y: h + 0.025 }, 0x2e86c1, 12);
    b.box(0.06, 0.012, 0.03, { x: w * 0.3 - 0.02, y: h + 0.05 }, 0xd4af37);
    // Mirror above.
    b.box(0.03, 0.6, 0.7, { x: 0, y: h + 0.75, z: -d / 2 + 0.02, ry: Math.PI / 2 }, 0xd4af37);
  },
  coat_rack({ b }) {
    b.cylU(0.03, 1.75, { y: 0.875 }, WOOD_DARK, 8);
    b.cyl(0.03, 0.22, 0.06, { y: 0.03 }, WOOD_DARK, 10);
    for (let i = 0; i < 4; i++) {
      const a = (i * Math.PI) / 2;
      b.box(0.14, 0.02, 0.02, { x: Math.cos(a) * 0.07, y: 1.7, z: Math.sin(a) * 0.07, ry: -a }, WOOD_DARK);
    }
    b.rbox(0.36, 0.75, 0.16, 0.06, { x: 0.12, y: 1.25, z: 0.02, rz: 0.08 }, 0xc0392b);
    b.rbox(0.32, 0.6, 0.14, 0.06, { x: -0.1, y: 1.32, z: -0.04, rz: -0.08 }, 0x34495e);
    b.cyl(0.13, 0.15, 0.08, { x: 0.02, y: 1.82 }, 0xf1c40f, 10);
  },
  shoe_rack({ b, w, d, h }) {
    b.rbox(w, h, d, 0.02, { y: h / 2 }, WHITE);
    b.box(w - 0.06, 0.02, d - 0.04, { y: h * 0.5 }, 0xdcd6cc);
    const shoe = (x: number, y: number, col: number) => {
      b.rbox(0.1, 0.07, 0.24, 0.035, { x, y: y + 0.035, z: 0.02 }, col);
    };
    shoe(-0.25, h, 0x8e5a3c);
    shoe(-0.13, h, 0x8e5a3c);
    shoe(0.12, h, 0xe74c3c);
    shoe(0.24, h, 0xe74c3c);
    shoe(-0.2, 0.02, 0x2c3e50);
    shoe(-0.08, 0.02, 0x2c3e50);
  },
  counter({ b, p, w, d, h }) {
    const main = w > 4;
    b.box(w, h - 0.1, d - 0.04, { y: (h - 0.1) / 2 + 0.08, z: -0.02 }, 0xf4f1ea);
    b.box(w, 0.08, d - 0.1, { y: 0.04, z: -0.06 }, 0xb9b1a5);
    b.box(w + 0.02, 0.05, d + 0.02, { y: h - 0.02 }, 0xb98b5c);
    const n = Math.round(w / 0.6);
    for (let i = 0; i < n; i++) {
      const x = -w / 2 + (i + 0.5) * (w / n);
      b.box(w / n - 0.03, h - 0.24, 0.01, { x, y: (h - 0.1) / 2 + 0.08, z: d / 2 - 0.035 }, 0xe8f1f2);
      b.box(0.1, 0.015, 0.02, { x, y: h - 0.2, z: d / 2 - 0.02 }, 0x9aa5ab);
    }
    // Backsplash tiles + upper cabinets.
    b.box(w, 0.55, 0.02, { y: h + 0.3, z: -d / 2 + 0.01 }, 0xe6eef2);
    for (let i = 0; i < w / 0.15; i++) {
      b.box(0.13, 0.13, 0.005, { x: -w / 2 + 0.075 + i * 0.15, y: h + 0.1 + (i % 2) * 0.15, z: -d / 2 + 0.025 }, i % 3 === 0 ? 0x7fb3d5 : 0xf5f5f5);
    }
    if (main) {
      // Sink under the window (window at world x = -2, i.e. local x = -2 - p.x).
      const sx = -2 - p.x;
      b.box(0.62, 0.02, 0.42, { x: sx, y: h + 0.005 }, 0xc8d1d6);
      b.box(0.5, 0.03, 0.32, { x: sx, y: h + 0.012 }, 0x8a969e);
      b.cylU(0.02, 0.3, { x: sx, y: h + 0.15, z: -d / 2 + 0.08 }, 0xb8c2c8, 8);
      b.box(0.02, 0.02, 0.18, { x: sx, y: h + 0.3, z: -d / 2 + 0.17 }, 0xb8c2c8);
      // Stove.
      const stx = 1.3;
      b.box(0.62, 0.02, 0.5, { x: stx, y: h + 0.01 }, 0x2d3436);
      for (const [ox, oz] of [[-0.15, -0.12], [0.15, -0.12], [-0.15, 0.12], [0.15, 0.12]]) {
        b.cylU(0.08, 0.012, { x: stx + ox, y: h + 0.025, z: oz }, 0x636e72, 12);
      }
      // A pot on the stove.
      b.cylU(0.13, 0.15, { x: stx + 0.15, y: h + 0.1, z: 0.12 }, 0xc0392b, 12);
      // Bread board.
      b.rbox(0.4, 0.02, 0.25, 0.01, { x: -2.0, y: h + 0.01, z: 0.05 }, WOOD_LIGHT);
      // Upper cabinets (left part).
      b.box(1.8, 0.6, 0.35, { x: -w / 2 + 0.9, y: 1.95, z: -d / 2 + 0.17 }, 0xf4f1ea);
      b.box(1.0, 0.6, 0.35, { x: w / 2 - 0.5, y: 1.95, z: -d / 2 + 0.17 }, 0xf4f1ea);
    } else {
      b.rbox(0.45, 0.28, 0.32, 0.03, { x: -0.5, y: h + 0.14, z: -0.05 }, 0xdfe6e9);
      b.box(0.3, 0.18, 0.01, { x: -0.55, y: h + 0.14, z: 0.115 }, 0x2d3436);
      b.cyl(0.07, 0.09, 0.2, { x: 0.5, y: h + 0.1 }, 0xe17055, 10);
      // Fruit bowl.
      b.cyl(0.16, 0.1, 0.07, { x: 0.05, y: h + 0.035 }, 0xfdcb6e, 12);
      b.sphere(0.05, { x: 0.02, y: h + 0.09, z: 0.02 }, 0xe74c3c);
      b.sphere(0.05, { x: 0.09, y: h + 0.09, z: -0.03 }, 0xf39c12);
      b.sphere(0.045, { x: 0.04, y: h + 0.1, z: -0.06 }, 0x6ab04c);
    }
  },
  fridge({ c, w, d, h }) {
    c.rbox(w, h, d, 0.08, { y: h / 2 }, 0xa8dcc9);
    c.box(w - 0.04, 0.012, 0.01, { y: h * 0.62, z: d / 2 + 0.002 }, 0x87bfaa);
    c.rbox(0.04, 0.32, 0.04, 0.015, { x: w / 2 - 0.1, y: h * 0.78, z: d / 2 + 0.03 }, 0xdfe6e9);
    c.rbox(0.04, 0.4, 0.04, 0.015, { x: w / 2 - 0.1, y: h * 0.4, z: d / 2 + 0.03 }, 0xdfe6e9);
    // Magnets and a kid drawing.
    c.box(0.22, 0.28, 0.005, { x: -0.1, y: h * 0.42, z: d / 2 + 0.006, rz: 0.06 }, 0xffffff);
    c.box(0.1, 0.1, 0.006, { x: -0.13, y: h * 0.45, z: d / 2 + 0.009 }, 0xf1c40f);
    c.sphere(0.022, { x: 0.05, y: h * 0.8, z: d / 2 + 0.01 }, 0xe74c3c);
    c.sphere(0.022, { x: -0.15, y: h * 0.75, z: d / 2 + 0.01 }, 0x3498db);
  },
  round_table({ b, h }) {
    b.cylU(0.56, 0.04, { y: h - 0.02 }, 0xf7f1e3, 16);
    b.cyl(0.6, 0.58, 0.16, { y: h - 0.1 }, 0xd35400, 16);
    b.cylU(0.05, h - 0.05, { y: (h - 0.05) / 2 }, WOOD_DARK, 8);
    b.cyl(0.08, 0.28, 0.05, { y: 0.025 }, WOOD_DARK, 12);
    b.cyl(0.07, 0.05, 0.12, { x: 0.15, y: h + 0.06 }, 0x74b9ff, 8);
    b.ico(0.07, { x: 0.15, y: h + 0.15 }, 0xff7675);
  },
  chair({ b, p }) {
    const col = p.color ?? WOOD;
    b.rbox(0.42, 0.05, 0.42, 0.02, { y: 0.46 }, col);
    legs4(b, 0.42, 0.42, 0.45, 0.018, 0.04, shade(col, 0.8));
    b.box(0.04, 0.48, 0.04, { x: -0.18, y: 0.7, z: -0.18 }, shade(col, 0.8));
    b.box(0.04, 0.48, 0.04, { x: 0.18, y: 0.7, z: -0.18 }, shade(col, 0.8));
    b.rbox(0.4, 0.16, 0.03, 0.015, { y: 0.84, z: -0.18 }, col);
  },
  dining_table({ b, w, d, h }) {
    b.rbox(w, 0.05, d, 0.02, { y: h - 0.025 }, WOOD);
    legs4(b, w, d, h - 0.05, 0.035, 0.1, WOOD_DARK);
    b.box(w - 0.2, 0.08, d - 0.2, { y: h - 0.09 }, WOOD_DARK);
    // Tablecloth (a runner) and a candle.
    b.box(w * 0.98, 0.006, 0.42, { y: h + 0.003 }, 0xf6e7d0);
    b.box(w * 0.98, 0.18, 0.006, { y: h - 0.08, z: 0.21 }, 0xf6e7d0);
    b.cylU(0.04, 0.03, { y: h + 0.02 }, 0xd4af37, 8);
    b.cylU(0.015, 0.15, { y: h + 0.1 }, 0xfffaf0, 8);
  },
  sofa({ b, p, w, d }) {
    const col = p.color ?? 0x5b7fa6;
    b.rbox(w, 0.3, d, 0.06, { y: 0.24 }, col);
    b.rbox(w - 0.36, 0.14, d - 0.3, 0.06, { y: 0.44, z: 0.1 }, shade(col, 1.12));
    b.rbox(w, 0.5, 0.24, 0.08, { y: 0.6, z: -d / 2 + 0.12 }, shade(col, 0.95));
    for (const sx of [-1, 1]) b.rbox(0.2, 0.42, d, 0.07, { x: sx * (w / 2 - 0.1), y: 0.5 }, shade(col, 0.92));
    legs4(b, w, d, 0.1, 0.025, 0.08, WOOD_DARK);
    b.rbox(0.42, 0.04, 0.6, 0.02, { x: 0.3, y: 0.52, z: 0.1, ry: 0.4 }, 0xf6e58d); // plaid
  },
  armchair({ b, p, w, d }) {
    const col = p.color ?? 0xd98a4e;
    b.rbox(w, 0.3, d, 0.06, { y: 0.24 }, col);
    b.rbox(w - 0.34, 0.14, d - 0.28, 0.06, { y: 0.44, z: 0.08 }, shade(col, 1.12));
    b.rbox(w, 0.55, 0.22, 0.08, { y: 0.62, z: -d / 2 + 0.11 }, shade(col, 0.95));
    for (const sx of [-1, 1]) b.rbox(0.18, 0.4, d, 0.07, { x: sx * (w / 2 - 0.09), y: 0.5 }, shade(col, 0.92));
    legs4(b, w, d, 0.1, 0.025, 0.08, WOOD_DARK);
  },
  coffee_table({ b, w, d, h }) {
    b.rbox(w, 0.05, d, 0.02, { y: h - 0.025 }, WOOD_LIGHT);
    legs4(b, w, d, h - 0.05, 0.025, 0.06, WOOD_DARK);
    b.box(w - 0.12, 0.02, d - 0.12, { y: 0.12 }, WOOD_LIGHT);
    b.box(0.25, 0.02, 0.18, { x: -0.25, y: h + 0.01, ry: 0.3 }, 0x3498db);
    b.box(0.22, 0.03, 0.15, { x: -0.26, y: 0.145, ry: -0.2 }, 0xe67e22);
  },
  tv_stand({ b, w, d, h }) {
    b.rbox(w, h, d, 0.02, { y: h / 2 }, 0x6d4c41);
    b.box(w - 0.08, h - 0.12, 0.01, { y: h / 2, z: d / 2 + 0.002 }, 0x8d6e63);
    b.box(0.3, 0.03, 0.18, { y: h + 0.015 }, 0x2d3436);
    b.box(0.06, 0.14, 0.04, { y: h + 0.1 }, 0x2d3436);
    b.rbox(1.25, 0.72, 0.05, 0.02, { y: h + 0.52 }, 0x2d3436);
    b.box(1.17, 0.64, 0.01, { y: h + 0.52, z: 0.027 }, 0x34495e);
    // Cartoon on the TV.
    b.box(0.5, 0.3, 0.005, { x: -0.2, y: h + 0.45, z: 0.034 }, 0x74b9ff);
    b.sphere(0.07, { x: 0.25, y: h + 0.62, z: 0.035, sz: 0.1 }, 0xfdcb6e);
    b.box(0.25, 0.2, 0.005, { x: 0.25, y: h + 0.38, z: 0.034 }, 0x55efc4);
  },
  washing_machine({ b, w, d, h }) {
    b.rbox(w, h, d, 0.04, { y: h / 2 }, 0xf5f6fa);
    b.box(w - 0.06, 0.1, 0.01, { y: h - 0.07, z: d / 2 + 0.002 }, 0xdfe6e9);
    b.torus(0.17, 0.03, { y: h * 0.45, z: d / 2 + 0.01 }, 0xb2bec3);
    b.cylU(0.15, 0.01, { y: h * 0.45, z: d / 2 + 0.006, rx: Math.PI / 2 }, 0x74b9ff, 16);
    b.cylU(0.03, 0.02, { x: w / 2 - 0.12, y: h - 0.07, z: d / 2 + 0.015, rx: Math.PI / 2 }, 0x636e72, 12);
  },
  bathtub({ b, w, d, h }) {
    b.rbox(w, h, d, 0.08, { y: h / 2 }, 0xf8f9fa);
    b.rbox(w - 0.14, 0.05, d - 0.14, 0.04, { y: h - 0.02 }, 0xbfe9f5);
    b.cylU(0.02, 0.25, { y: h + 0.12, z: -d / 2 + 0.06 }, 0xb8c2c8, 8);
    // Rubber duck decor.
    b.sphere(0.06, { x: 0.1, y: h + 0.04, z: 0.2, sy: 0.8 }, 0xf9ca24);
    b.sphere(0.04, { x: 0.1, y: h + 0.11, z: 0.25 }, 0xf9ca24);
    b.cone(0.015, 0.04, { x: 0.1, y: h + 0.105, z: 0.3, rx: Math.PI / 2 }, 0xf0932b);
  },
  toilet({ b, w, d }) {
    b.cyl(0.18, 0.13, 0.4, { y: 0.2, z: 0.08 }, 0xf8f9fa, 12);
    b.cyl(0.2, 0.2, 0.05, { y: 0.42, z: 0.08 }, 0xecf0f1, 14);
    b.rbox(w, 0.38, 0.18, 0.04, { y: 0.6, z: -d / 2 + 0.09 }, 0xf8f9fa);
    b.box(0.08, 0.02, 0.04, { x: 0.1, y: 0.8, z: -d / 2 + 0.09 }, 0xb2bec3);
  },
  vanity({ b, w, d, h }) {
    b.rbox(w, h - 0.1, d, 0.02, { y: (h - 0.1) / 2 + 0.1 }, 0x81ecec);
    b.box(w + 0.04, 0.05, d + 0.02, { y: h }, 0xf5f6fa);
    b.cyl(0.18, 0.14, 0.06, { y: h + 0.02, z: 0.03 }, 0xffffff, 14);
    b.cylU(0.015, 0.15, { y: h + 0.08, z: -d / 2 + 0.05 }, 0xb8c2c8, 8);
    b.box(w - 0.1, 0.6, 0.02, { y: h + 0.65, z: -d / 2 + 0.01 }, 0xd4af37);
    b.box(w - 0.16, 0.54, 0.01, { y: h + 0.65, z: -d / 2 + 0.025 }, 0xdff9fb);
    b.cylU(0.03, 0.12, { x: w / 2 - 0.1, y: h + 0.08 }, 0xfd79a8, 8);
  },
  rug({ b, p, w, d }) {
    const col = p.color ?? 0xc98b7a;
    b.box(w, 0.012, d, { y: 0.008 }, shade(col, 0.8));
    b.box(w - 0.16, 0.014, d - 0.16, { y: 0.01 }, col);
    b.box(w - 0.4, 0.016, d - 0.4, { y: 0.011 }, shade(col, 1.15));
  },
  rug_round({ b, p, w }) {
    const col = p.color ?? 0x7cc4a8;
    b.cylU(w / 2, 0.012, { y: 0.008 }, shade(col, 0.82), 16);
    b.cylU(w / 2 - 0.12, 0.014, { y: 0.01 }, col, 16);
    b.cylU(w / 2 - 0.45, 0.016, { y: 0.011 }, shade(col, 1.18), 16);
  },
  floor_lamp({ b }) {
    b.cyl(0.12, 0.15, 0.04, { y: 0.02 }, 0x2d3436, 12);
    b.cylU(0.015, 1.45, { y: 0.74 }, 0x2d3436, 8);
    b.cyl(0.15, 0.24, 0.3, { y: 1.5 }, 0xffeaa7, 12);
  },
  picture({ b, p }) {
    const col = p.color ?? 0x7aa6c2;
    b.box(0.7, 0.5, 0.03, { y: 1.55 }, 0x8d6e63);
    b.box(0.6, 0.4, 0.01, { y: 1.55, z: 0.016 }, col);
    b.sphere(0.07, { x: 0.12, y: 1.62, z: 0.02, sz: 0.1 }, 0xfdcb6e);
    b.box(0.6, 0.12, 0.012, { y: 1.41, z: 0.018 }, shade(col, 0.7));
  },
  garden_table({ b, h }) {
    b.cylU(0.6, 0.03, { y: h - 0.015 }, 0xf5f6fa, 16);
    b.cylU(0.03, h, { y: h / 2 }, METAL, 8);
    b.cyl(0.04, 0.3, 0.05, { y: 0.025 }, METAL, 12);
  },
  garden_chair({ b, p }) {
    const col = p.color ?? 0x2e8b57;
    b.rbox(0.42, 0.03, 0.42, 0.015, { y: 0.45 }, col);
    for (const sx of [-1, 1]) for (const sz of [-1, 1]) {
      b.cylU(0.013, 0.45, { x: sx * 0.18, y: 0.225, z: sz * 0.18 }, shade(col, 0.8), 8);
    }
    b.rbox(0.42, 0.35, 0.025, 0.015, { y: 0.7, z: -0.2, rx: -0.12 }, col);
  },
  parasol({ b }) {
    b.cylU(0.025, 2.2, { y: 1.1 }, 0xdfe6e9, 8);
    // Striped canopy built from triangles.
    const n = 10;
    const r = 1.2;
    const top = 2.35;
    const rim = 1.9;
    for (let i = 0; i < n; i++) {
      const a0 = (i / n) * Math.PI * 2;
      const a1 = ((i + 1) / n) * Math.PI * 2;
      const verts = [0, top, 0, Math.cos(a1) * r, rim, Math.sin(a1) * r, Math.cos(a0) * r, rim, Math.sin(a0) * r];
      b.tris(verts, i % 2 ? 0xffffff : 0xe55039);
      b.tris([0, top - 0.02, 0, Math.cos(a0) * r, rim - 0.02, Math.sin(a0) * r, Math.cos(a1) * r, rim - 0.02, Math.sin(a1) * r], i % 2 ? 0xe8e8e8 : 0xc0392b);
    }
  },
  clothes_post({ b }) {
    b.cylU(0.05, 1.9, { y: 0.95 }, 0xdfe6e9, 8);
    b.box(0.7, 0.06, 0.06, { y: 1.85 }, 0xdfe6e9);
  },
  clothesline_basket({ b }) {
    b.cyl(0.3, 0.24, 0.3, { y: 0.15, sz: 0.75 }, 0xd1a35f, 12);
    b.torus(0.29, 0.03, { y: 0.3, rx: Math.PI / 2, sz: 0.75 }, 0xb8864b);
    b.ico(0.16, { x: 0.05, y: 0.3, sy: 0.5 }, 0x74b9ff);
    b.ico(0.12, { x: -0.1, y: 0.32, z: 0.05, sy: 0.5 }, 0xffffff);
  },
  shed({ c, w, d, h }) {
    const wood = 0x8d6e4f;
    for (let i = 0; i < 10; i++) {
      const x = -w / 2 + (i + 0.5) * (w / 10);
      c.box(w / 10 - 0.01, h - 0.3, d, { x, y: (h - 0.3) / 2 }, shade(wood, 0.9 + hash(i, 5) * 0.2));
    }
    // Door on the front.
    c.box(0.9, 1.8, 0.04, { y: 0.9, z: d / 2 + 0.02 }, 0x6d8b74);
    c.sphere(0.03, { x: 0.32, y: 0.95, z: d / 2 + 0.05 }, 0xd4af37);
    c.box(0.5, 0.4, 0.03, { x: 0.9, y: 1.45, z: d / 2 + 0.02 }, 0xcfeaf6);
    // Roof.
    const rh = 0.55;
    const y0 = h - 0.3;
    const W = w / 2 + 0.25;
    const D = d / 2 + 0.25;
    c.tris([-W, y0, -D, -W, y0 + rh, 0, W, y0 + rh, 0, -W, y0, -D, W, y0 + rh, 0, W, y0, -D], 0x4a5a50);
    c.tris([-W, y0, D, W, y0 + rh, 0, -W, y0 + rh, 0, -W, y0, D, W, y0, D, W, y0 + rh, 0], 0x55675b);
    c.tris([-w / 2, y0, -d / 2, -w / 2, y0, d / 2, -w / 2, y0 + rh, 0], wood);
    c.tris([w / 2, y0, d / 2, w / 2, y0, -d / 2, w / 2, y0 + rh, 0], wood);
    // Tools leaning on the side.
    c.box(0.04, 1.3, 0.04, { x: -w / 2 - 0.1, y: 0.65, z: 0.5, rz: 0.15 }, WOOD);
    c.box(0.25, 0.3, 0.02, { x: -w / 2 - 0.2, y: 0.12, z: 0.5, rz: 0.15 }, METAL);
  },
  sandbox({ b, w, d }) {
    const wood = 0xc49a6c;
    b.box(w, 0.25, 0.1, { y: 0.125, z: -d / 2 + 0.05 }, wood);
    b.box(w, 0.25, 0.1, { y: 0.125, z: d / 2 - 0.05 }, wood);
    b.box(0.1, 0.25, d, { x: -w / 2 + 0.05, y: 0.125 }, wood);
    b.box(0.1, 0.25, d, { x: w / 2 - 0.05, y: 0.125 }, wood);
    b.box(w - 0.2, 0.06, d - 0.2, { y: 0.1 }, 0xf0d9a0);
    b.cyl(0.08, 0.1, 0.14, { x: 0.3, y: 0.2, z: 0.2 }, 0xe74c3c, 10);
    b.box(0.06, 0.02, 0.25, { x: 0.1, y: 0.15, z: -0.3, ry: 0.5 }, 0x3498db);
    b.ico(0.16, { x: -0.3, y: 0.18, z: -0.2, sy: 0.6 }, 0xe9cf8f);
  },
  slide({ b, w, d, h }) {
    const plat = 1.1;
    for (const sx of [-1, 1]) {
      b.cylU(0.04, plat + 0.4, { x: sx * w / 2, y: (plat + 0.4) / 2, z: -d / 2 + 0.1 }, 0x3498db, 8);
      b.cylU(0.04, plat, { x: sx * w / 2, y: plat / 2, z: -d / 2 + 0.6 }, 0x3498db, 8);
    }
    b.box(w, 0.06, 0.6, { y: plat, z: -d / 2 + 0.35 }, 0xf1c40f);
    for (let i = 1; i < 4; i++) b.box(w, 0.04, 0.04, { y: (i * plat) / 4, z: -d / 2 + 0.1 }, 0xecf0f1);
    const len = Math.hypot(d - 0.6, plat);
    const ang = Math.atan2(plat, d - 0.6);
    b.box(w - 0.1, 0.05, len, { y: plat / 2 + 0.05, z: (0.6 - d / 2 + d / 2) / 2 + 0.05, rx: ang }, 0xe74c3c);
    b.box(0.04, 0.12, len, { x: -(w - 0.1) / 2, y: plat / 2 + 0.11, z: 0.35, rx: ang }, 0xc0392b);
    b.box(0.04, 0.12, len, { x: (w - 0.1) / 2, y: plat / 2 + 0.11, z: 0.35, rx: ang }, 0xc0392b);
    void h;
  },
  tree({ c, p }) {
    const v = p.v ?? 0;
    const trunkH = v === 2 ? 2.2 : 2.8;
    c.cyl(0.18, 0.3, trunkH, { y: trunkH / 2 }, 0x7b5e45, 8);
    c.cyl(0.08, 0.12, 1.0, { x: 0.35, y: trunkH - 0.2, rz: -0.7 }, 0x7b5e45, 6);
    const base = v === 1 ? 0x4e8f3a : v === 2 ? 0x6aaa4b : 0x5a9e45;
    foliage(c, 0, trunkH + 1.1, 0, v === 2 ? 1.4 : 1.9, base, 17 + v * 7, 7);
  },
  fruit_tree({ c, p }) {
    const v = p.v ?? 0;
    const trunkH = 1.5;
    c.cyl(0.1, 0.16, trunkH, { y: trunkH / 2 }, 0x8a6a50, 8);
    const base = v === 1 ? 0xf3b6c8 : v === 2 ? 0x7cb342 : 0x6ab04c;
    foliage(c, 0, trunkH + 0.75, 0, 1.15, base, 33 + v, 6);
    if (v === 0) {
      for (let i = 0; i < 10; i++) {
        const a = hash(i, 9) * Math.PI * 2;
        c.sphere(0.07, { x: Math.cos(a) * 0.9, y: trunkH + 0.5 + hash(i, 4) * 0.8, z: Math.sin(a) * 0.9 }, 0xd63031, 'lo');
      }
    }
    if (v === 1) {
      for (let i = 0; i < 14; i++) {
        const a = hash(i, 19) * Math.PI * 2;
        c.sphere(0.06, { x: Math.cos(a) * 0.95, y: trunkH + 0.5 + hash(i, 14) * 0.9, z: Math.sin(a) * 0.95 }, 0xffffff, 'lo');
      }
    }
  },
  bush({ b, p, w }) {
    const v = p.v ?? 0;
    foliage(b, 0, 0.45, 0, w * 0.5, v === 1 ? 0x4f9a46 : 0x5fae4a, 71 + Math.round(p.x * 3 + p.z), 5);
    if (v === 1) {
      for (let i = 0; i < 9; i++) {
        const a = hash(i, 3 + Math.round(p.x)) * Math.PI * 2;
        b.sphere(0.06, { x: Math.cos(a) * 0.45, y: 0.5 + hash(i, 8) * 0.4, z: Math.sin(a) * 0.45 }, i % 2 ? 0xff8fab : 0xffffff, 'lo');
      }
    }
  },
  car({ c, p, w, d }) {
    const col = p.color ?? 0xd2483a;
    const v = p.v ?? 0;
    const bodyH = 0.62;
    c.rbox(w, bodyH, d, 0.18, { y: 0.3 + bodyH / 2 }, col);
    const cabL = v === 1 ? d * 0.55 : d * 0.5;
    const cabZ = v === 2 ? -0.15 : -0.1;
    c.rbox(w - 0.14, 0.55, cabL, 0.16, { y: 0.3 + bodyH + 0.24, z: cabZ }, col);
    // Windows.
    c.rbox(w - 0.1, 0.38, cabL - 0.3, 0.1, { y: 0.3 + bodyH + 0.26, z: cabZ }, 0x9fc9dc);
    c.box(w - 0.08, 0.36, 0.05, { y: 0.3 + bodyH + 0.26, z: cabZ + cabL / 2 - 0.08, rx: -0.35 }, 0xa9d6e8);
    c.box(w - 0.08, 0.34, 0.05, { y: 0.3 + bodyH + 0.26, z: cabZ - cabL / 2 + 0.08, rx: 0.3 }, 0xa9d6e8);
    // Wheels.
    for (const sx of [-1, 1]) for (const sz of [-1, 1]) {
      c.cylU(0.32, 0.24, { x: sx * (w / 2 - 0.12), y: 0.32, z: sz * (d / 2 - 0.75), rz: Math.PI / 2 }, 0x2d3436, 12);
      c.cylU(0.16, 0.25, { x: sx * (w / 2 - 0.12), y: 0.32, z: sz * (d / 2 - 0.75), rz: Math.PI / 2 }, 0xb2bec3, 8);
    }
    // Lights and bumpers.
    for (const sx of [-1, 1]) {
      c.sphere(0.1, { x: sx * (w / 2 - 0.3), y: 0.72, z: d / 2 - 0.02, sz: 0.4 }, 0xfff6c8);
      c.sphere(0.09, { x: sx * (w / 2 - 0.3), y: 0.72, z: -d / 2 + 0.02, sz: 0.4 }, 0xe74c3c);
    }
    c.rbox(w + 0.04, 0.16, 0.14, 0.06, { y: 0.4, z: d / 2 }, 0xdfe6e9);
    c.rbox(w + 0.04, 0.16, 0.14, 0.06, { y: 0.4, z: -d / 2 }, 0xdfe6e9);
    c.box(0.4, 0.1, 0.02, { y: 0.55, z: -d / 2 - 0.08 }, 0xffffff);
  },
  streetlamp({ c, h }) {
    c.cyl(0.1, 0.16, 0.5, { y: 0.25 }, GREEN_IRON, 8);
    c.cylU(0.06, h - 0.5, { y: (h - 0.5) / 2 + 0.5 }, GREEN_IRON, 8);
    c.box(0.6, 0.05, 0.05, { x: 0.25, y: h - 0.1 }, GREEN_IRON);
    c.cyl(0.12, 0.2, 0.4, { x: 0.52, y: h - 0.32 }, 0xfff3c4, 6);
    c.cone(0.26, 0.22, { x: 0.52, y: h - 0.03 }, GREEN_IRON, 8);
  },
  plane_tree({ c, p }) {
    const trunkH = 3.4;
    c.cyl(0.25, 0.36, trunkH, { y: trunkH / 2 }, 0xb7aa8c, 10);
    for (let i = 0; i < 6; i++) {
      c.sphere(0.16, { x: Math.cos(i * 2) * 0.27, y: 0.6 + i * 0.45, z: Math.sin(i * 2) * 0.27, sz: 0.4, ry: i * 2 }, 0xd8cfb2, 'lo');
    }
    c.cyl(0.1, 0.16, 1.4, { x: 0.6, y: trunkH + 0.2, rz: -0.6 }, 0xb7aa8c, 6);
    c.cyl(0.1, 0.16, 1.4, { x: -0.5, y: trunkH + 0.25, rz: 0.6, ry: 0.5 }, 0xb7aa8c, 6);
    foliage(c, 0, trunkH + 1.9, 0, 2.3, 0x76b04e, 91 + Math.round(p.x), 8);
    c.box(1.2, 0.03, 1.2, { y: 0.015 }, 0x4a4a4a);
  },
  bench({ b, w }) {
    for (const sx of [-1, 1]) {
      b.box(0.06, 0.45, 0.5, { x: sx * (w / 2 - 0.12), y: 0.225 }, GREEN_IRON);
      b.box(0.06, 0.5, 0.06, { x: sx * (w / 2 - 0.12), y: 0.65, z: -0.22, rx: -0.15 }, GREEN_IRON);
    }
    for (let i = 0; i < 4; i++) b.box(w, 0.04, 0.1, { y: 0.46, z: -0.18 + i * 0.12 }, 0xb5835a);
    for (let i = 0; i < 3; i++) b.box(w, 0.1, 0.035, { y: 0.62 + i * 0.13, z: -0.25 - i * 0.02, rx: -0.15 }, 0xb5835a);
  },
  bollard({ b }) {
    b.cylU(0.11, 0.75, { y: 0.375 }, GREEN_IRON, 10);
    b.sphere(0.12, { y: 0.76 }, GREEN_IRON);
    b.cylU(0.115, 0.06, { y: 0.6 }, 0xf1c40f, 10);
  },
  barrier({ b, w, p }) {
    for (const sx of [-1, 1]) {
      b.box(0.06, 1.0, 0.06, { x: sx * (w / 2 - 0.1), y: 0.5 }, 0xdfe6e9);
      b.box(0.3, 0.05, 0.4, { x: sx * (w / 2 - 0.1), y: 0.025 }, 0x2d3436);
    }
    const n = 8;
    for (let i = 0; i < n; i++) {
      const col = i % 2 ? 0xffffff : 0xe74c3c;
      b.box(w / n, 0.22, 0.04, { x: -w / 2 + (i + 0.5) * (w / n), y: 0.8 }, col);
      b.box(w / n, 0.12, 0.04, { x: -w / 2 + (i + 0.5) * (w / n), y: 0.4 }, i % 2 ? 0xe74c3c : 0xffffff);
    }
    if (p.v === 1) {
      b.cyl(0.18, 0.25, 0.6, { x: 0.3, y: 0.3, z: 0.4 }, 0xff7f27, 10);
      b.cylU(0.19, 0.08, { x: 0.3, y: 0.35, z: 0.4 }, 0xffffff, 10);
    }
  },
  spring_rider({ b, p }) {
    const col = p.v === 1 ? 0xf9ca24 : 0xe74c3c;
    b.cylU(0.2, 0.05, { y: 0.025 }, 0x636e72, 10);
    for (let i = 0; i < 5; i++) b.torus(0.08, 0.02, { y: 0.1 + i * 0.07, rx: Math.PI / 2 }, 0x2d3436);
    b.rbox(0.25, 0.25, 0.6, 0.1, { y: 0.55 }, col);
    b.sphere(0.15, { y: 0.78, z: 0.3 }, col);
    b.sphere(0.04, { x: 0.08, y: 0.82, z: 0.42 }, 0x2d3436);
    b.sphere(0.04, { x: -0.08, y: 0.82, z: 0.42 }, 0x2d3436);
    b.box(0.4, 0.03, 0.03, { y: 0.75, z: 0.15 }, 0x2d3436);
  },
  planter({ b, w, d, h }) {
    b.box(w, h, d, { y: h / 2 }, 0xc0703f);
    b.box(w - 0.08, 0.04, d - 0.08, { y: h - 0.02 }, 0x6b4a32);
    flowers(b, -w / 2 + 0.08, -d / 2 + 0.08, w / 2 - 0.08, d / 2 - 0.08, h, 3 + Math.round(Math.abs(w * 10)), 30);
  },
  veg_patch({ b, p, w, d }) {
    b.box(w, 0.12, d, { y: 0.06 }, 0x5d4030);
    for (const sx of [-1, 1]) b.box(w + 0.1, 0.18, 0.06, { y: 0.09, z: sx * (d / 2 + 0.03) }, 0x9a7650);
    for (const sx of [-1, 1]) b.box(0.06, 0.18, d + 0.1, { x: sx * (w / 2 + 0.03), y: 0.09 }, 0x9a7650);
    const rows = 4;
    for (let r = 0; r < rows; r++) {
      const z = -d / 2 + (r + 0.5) * (d / rows);
      for (let i = 0; i < 7; i++) {
        const x = -w / 2 + 0.3 + i * ((w - 0.6) / 6);
        if (r === 0) {
          b.cylU(0.012, 0.6, { x, y: 0.42, z }, 0x8d6e63, 6);
          b.ico(0.13, { x, y: 0.45, z }, 0x4caf50);
          b.sphere(0.05, { x: x + 0.06, y: 0.4, z: z + 0.05 }, 0xe53935, 'lo');
        } else if (r === 1) {
          b.cone(0.07, 0.22, { x, y: 0.22, z }, 0x7cb342);
        } else {
          b.ico(0.12, { x, y: 0.18, z, sy: 0.6 }, r === 2 ? 0x66bb6a : 0x9ccc65);
        }
      }
    }
    void p;
  },
  flowerbed({ b, p, w, d }) {
    b.box(w, 0.1, d, { y: 0.05 }, 0x6b4a32);
    const n = Math.max(4, Math.round((w + d) * 2 / 0.35));
    for (let i = 0; i < n; i++) {
      const t = i / n;
      const per = 2 * (w + d);
      let s = t * per;
      let x: number;
      let z: number;
      if (s < w) { x = -w / 2 + s; z = -d / 2; }
      else if ((s -= w) < d) { x = w / 2; z = -d / 2 + s; }
      else if ((s -= d) < w) { x = w / 2 - s; z = d / 2; }
      else { s -= w; x = -w / 2; z = d / 2 - s; }
      b.ico(0.1, { x, y: 0.08, z, sy: 0.6 }, 0xbdb7a8, 0.2);
    }
    flowers(b, -w / 2 + 0.15, -d / 2 + 0.15, w / 2 - 0.15, d / 2 - 0.15, 0.1, 51 + Math.round(p.x), 14);
  },
  bike({ b, d }) {
    for (const sz of [-1, 1]) {
      b.torus(0.32, 0.03, { y: 0.34, z: sz * (d / 2 - 0.33), ry: Math.PI / 2 }, 0x2d3436);
      b.cylU(0.02, 0.6, { y: 0.34, z: sz * (d / 2 - 0.33), rz: Math.PI / 2, sx: 0.5 }, 0xb2bec3, 8);
    }
    b.box(0.04, 0.04, 0.85, { y: 0.62, z: 0, rx: 0.12 }, 0x00a8ff);
    b.box(0.04, 0.5, 0.04, { y: 0.5, z: -0.15, rx: 0.3 }, 0x00a8ff);
    b.box(0.04, 0.5, 0.04, { y: 0.5, z: 0.45, rx: -0.3 }, 0x00a8ff);
    b.rbox(0.12, 0.05, 0.22, 0.02, { y: 0.82, z: -0.25 }, 0x2d3436);
    b.box(0.45, 0.03, 0.03, { y: 0.9, z: 0.5 }, 0x2d3436);
    b.rbox(0.25, 0.15, 0.2, 0.03, { y: 0.8, z: 0.62 }, 0xd1a35f);
  },
  roadsign({ b }) {
    b.cylU(0.04, 2.4, { y: 1.2 }, 0x95a5a6, 8);
  },
  cafe_table({ b, h }) {
    b.cylU(0.33, 0.03, { y: h }, 0xdfe6e9, 14);
    b.cylU(0.025, h, { y: h / 2 }, 0x2d3436, 8);
    b.cyl(0.04, 0.22, 0.04, { y: 0.02 }, 0x2d3436, 10);
    b.cyl(0.04, 0.035, 0.08, { x: 0.08, y: h + 0.05 }, 0xffffff, 8);
    b.cylU(0.06, 0.012, { x: 0.08, y: h + 0.01 }, 0xffffff, 10);
  },
  awning({ b, w, d, h }) {
    const n = Math.round(w / 0.5);
    const drop = 0.5;
    for (let i = 0; i < n; i++) {
      const x = -w / 2 + (i + 0.5) * (w / n);
      const col = i % 2 ? 0xffffff : 0xb03a2e;
      b.box(w / n, 0.03, Math.hypot(d, drop), { x, y: h - drop / 2, z: 0, rx: -Math.atan2(drop, d) }, col);
      b.box(w / n, 0.22, 0.02, { x, y: h - drop - 0.1, z: d / 2 }, col);
    }
  },
  mailbox_post({ b }) {
    b.box(0.08, 1.0, 0.08, { y: 0.5 }, 0x7f8c8d);
    b.rbox(0.35, 0.28, 0.28, 0.04, { y: 1.12 }, 0xf1c40f);
    b.box(0.2, 0.02, 0.01, { y: 1.18, z: 0.145 }, 0x2d3436);
  },
  dog_bowl({ b }) {
    b.cyl(0.14, 0.12, 0.07, { y: 0.035 }, 0xe74c3c, 14);
    b.cylU(0.11, 0.02, { y: 0.065 }, 0x8d5524, 12);
    b.cyl(0.14, 0.12, 0.07, { x: 0.32, y: 0.035 }, 0x3498db, 14);
    b.cylU(0.11, 0.02, { x: 0.32, y: 0.06 }, 0x9fd3f0, 12);
  },
  pot_decor({ b, p }) {
    b.cyl(0.24, 0.17, 0.4, { y: 0.2 }, 0xc0703f, 12);
    b.cylU(0.25, 0.05, { y: 0.4 }, 0xa85f33, 12);
    foliage(b, 0, 0.62, 0, 0.3, 0x4f9a46, 13 + Math.round(p.x), 4);
    flowers(b, -0.15, -0.15, 0.15, 0.15, 0.6, 7, 40);
  },
  hydrant({ b }) {
    b.cylU(0.13, 0.6, { y: 0.3 }, 0xd63031, 10);
    b.sphere(0.14, { y: 0.62 }, 0xd63031);
    b.cylU(0.05, 0.14, { y: 0.4, rz: Math.PI / 2 }, 0xb71c1c, 8);
    b.cylU(0.15, 0.05, { y: 0.03 }, 0x636e72, 10);
  },
  kennel({ b, w, d, h }) {
    const body = 0xd9a066;
    b.box(w, h - 0.35, d, { y: (h - 0.35) / 2 }, body);
    b.box(0.5, 0.55, 0.02, { y: 0.32, z: d / 2 + 0.005 }, 0x3e2723);
    b.cylU(0.25, 0.02, { y: 0.6, z: d / 2 + 0.006, rx: Math.PI / 2 }, 0x3e2723, 12);
    const y0 = h - 0.35;
    const rh = 0.45;
    const W = w / 2 + 0.12;
    const D = d / 2 + 0.12;
    b.tris([-W, y0, -D, W, y0, -D, W, y0 + rh, 0, -W, y0, -D, W, y0 + rh, 0, -W, y0 + rh, 0], 0xc0392b);
    b.tris([-W, y0, D, W, y0 + rh, 0, W, y0, D, -W, y0, D, -W, y0 + rh, 0, W, y0 + rh, 0], 0xd35400);
    b.tris([-w / 2, y0, -d / 2, -w / 2, y0 + rh, 0, -w / 2, y0, d / 2], body);
    b.tris([w / 2, y0, d / 2, w / 2, y0 + rh, 0, w / 2, y0, -d / 2], body);
    b.box(0.5, 0.14, 0.02, { y: y0 - 0.12, z: d / 2 + 0.012 }, 0xffffff);
  },
  toybox({ b, w, d, h }) {
    b.rbox(w, h - 0.06, d, 0.03, { y: (h - 0.06) / 2 }, 0xff7675);
    b.rbox(w + 0.04, 0.08, d + 0.04, 0.03, { y: h - 0.03 }, 0xfdcb6e);
    b.sphere(0.06, { x: -0.2, y: h * 0.5, z: d / 2 + 0.01, sz: 0.2 }, 0x74b9ff);
    b.sphere(0.05, { x: 0.15, y: h * 0.55, z: d / 2 + 0.01, sz: 0.2 }, 0x55efc4);
    b.box(0.1, 0.1, 0.01, { x: 0.0, y: h * 0.4, z: d / 2 + 0.006, rz: 0.78 }, 0xffeaa7);
  },
  hamper({ b }) {
    b.cyl(0.27, 0.22, 0.58, { y: 0.29 }, 0xd8b27e, 12);
    for (let i = 0; i < 4; i++) b.torus(0.25 - i * 0.012, 0.012, { y: 0.1 + i * 0.13, rx: Math.PI / 2 }, 0xb98d55);
    b.cyl(0.29, 0.29, 0.05, { y: 0.6 }, 0xc9a06a, 12);
    b.rbox(0.12, 0.2, 0.03, 0.02, { x: 0.18, y: 0.55, z: 0.2, rz: 0.4 }, 0x74b9ff);
  },
  dog_basket({ b }) {
    b.cylU(0.55, 0.12, { y: 0.06 }, 0x8e2b2b, 16);
    b.torus(0.48, 0.13, { y: 0.18, rx: Math.PI / 2 }, 0xc0392b);
    b.cylU(0.45, 0.08, { y: 0.1 }, 0xf6e7d0, 16);
    // Bone toy.
    b.cylU(0.03, 0.22, { x: 0.25, y: 0.16, z: 0.3, rz: Math.PI / 2, ry: 0.6 }, 0xffffff, 8);
    for (const s of [-1, 1]) b.sphere(0.04, { x: 0.25 + s * 0.09 * Math.cos(0.6), y: 0.16, z: 0.3 - s * 0.09 * Math.sin(0.6) }, 0xffffff, 'lo');
  },
  bakery_stand({ b, w, d, h }) {
    b.box(w, h - 0.1, d, { y: (h - 0.1) / 2 }, 0x8b5a3c);
    b.box(w + 0.1, 0.05, d + 0.1, { y: h - 0.08 }, 0xd9b48a);
    for (let i = 0; i < 3; i++) {
      const x = -w / 2 + 0.4 + i * 0.8;
      b.cyl(0.22, 0.18, 0.12, { x, y: h - 0.02, z: -0.05, sz: 0.7 }, 0xc8a26a, 12);
    }
    // Decorative baguettes standing in a basket at the end.
    b.cyl(0.18, 0.16, 0.4, { x: w / 2 + 0.25, y: 0.2 }, 0xc8a26a, 10);
    for (let i = 0; i < 5; i++) {
      b.cylU(0.035, 0.7, { x: w / 2 + 0.25 + (i - 2) * 0.05, y: 0.55, z: (i % 2) * 0.05, rz: (i - 2) * 0.08 }, 0xd9a35b, 8);
    }
  },
  swing_set() {},
  bus_shelter() {},
};

/** Builds a prop into the opaque/occluder world builders. */
export function buildProp(p: PropDef, opaque: GeoBuilder, occluder: GeoBuilder): void {
  const fn = B[p.type];
  if (!fn) return;
  const e = propExtents(p);
  const local = new GeoBuilder();
  const localC = new GeoBuilder();
  fn({ b: local, c: localC, p, w: e.w, d: e.d, h: e.h });
  const m = new THREE.Matrix4().makeRotationY(((p.rot ?? 0) * Math.PI) / 2);
  m.setPosition(p.x, 0, p.z);
  if (!local.empty) {
    const g = local.build();
    g.applyMatrix4(m);
    opaque.addRaw(g);
  }
  if (!localC.empty) {
    const g = localC.build();
    g.applyMatrix4(m);
    occluder.addRaw(g);
  }
}
