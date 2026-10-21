// Procedural canvas textures (no external image files, no licensing issues).
import * as THREE from 'three';
import type { FloorKind } from '../../shared/world/types';

function rng(seed: number) {
  let s = seed >>> 0 || 1;
  return () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function canvas(w: number, h: number): [HTMLCanvasElement, CanvasRenderingContext2D] {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  const ctx = c.getContext('2d')!;
  return [c, ctx];
}

function hsl(h: number, s: number, l: number, a = 1) {
  return `hsla(${h},${s}%,${l}%,${a})`;
}

function noise(ctx: CanvasRenderingContext2D, w: number, h: number, amount: number, seed: number, size = 2) {
  const r = rng(seed);
  for (let i = 0; i < (w * h) / (size * size) * 0.35; i++) {
    const x = r() * w;
    const y = r() * h;
    const v = r();
    ctx.fillStyle = v > 0.5 ? `rgba(255,255,255,${amount * r()})` : `rgba(0,0,0,${amount * r()})`;
    ctx.fillRect(x, y, size, size);
  }
}

type Painter = (ctx: CanvasRenderingContext2D, w: number, h: number) => void;

const painters: Record<FloorKind, { size: number; tile: number; paint: Painter }> = {
  grass: {
    size: 256, tile: 4, paint(ctx, w, h) {
      ctx.fillStyle = '#7fb85a';
      ctx.fillRect(0, 0, w, h);
      const r = rng(11);
      for (let i = 0; i < 2600; i++) {
        const x = r() * w;
        const y = r() * h;
        const l = 38 + r() * 18;
        ctx.strokeStyle = hsl(88 + r() * 20, 45 + r() * 15, l, 0.55);
        ctx.lineWidth = 1 + r();
        ctx.beginPath();
        ctx.moveTo(x, y);
        ctx.lineTo(x + (r() - 0.5) * 3, y - 2 - r() * 5);
        ctx.stroke();
      }
      for (let i = 0; i < 40; i++) {
        ctx.fillStyle = hsl(85 + r() * 25, 40, 40 + r() * 12, 0.18);
        ctx.beginPath();
        ctx.arc(r() * w, r() * h, 8 + r() * 22, 0, Math.PI * 2);
        ctx.fill();
      }
    },
  },
  parquet: {
    size: 256, tile: 2.4, paint(ctx, w, h) {
      const r = rng(21);
      const rows = 8;
      const rh = h / rows;
      for (let row = 0; row < rows; row++) {
        let x = -r() * 120;
        while (x < w) {
          const len = 70 + r() * 90;
          const l = 52 + r() * 10;
          ctx.fillStyle = hsl(28 + r() * 6, 45 + r() * 10, l);
          ctx.fillRect(x, row * rh, len, rh);
          ctx.strokeStyle = 'rgba(70,40,20,0.12)';
          for (let k = 0; k < 4; k++) {
            ctx.beginPath();
            const yy = row * rh + 4 + r() * (rh - 8);
            ctx.moveTo(x, yy);
            ctx.bezierCurveTo(x + len * 0.3, yy + (r() - 0.5) * 6, x + len * 0.6, yy + (r() - 0.5) * 6, x + len, yy);
            ctx.stroke();
          }
          ctx.fillStyle = 'rgba(60,35,15,0.45)';
          ctx.fillRect(x, row * rh, 1.5, rh);
          x += len;
        }
        ctx.fillStyle = 'rgba(60,35,15,0.4)';
        ctx.fillRect(0, row * rh, w, 1.5);
      }
      noise(ctx, w, h, 0.05, 3);
    },
  },
  parquet_light: {
    size: 256, tile: 2.4, paint(ctx, w, h) {
      const r = rng(22);
      const rows = 8;
      const rh = h / rows;
      for (let row = 0; row < rows; row++) {
        let x = -r() * 120;
        while (x < w) {
          const len = 80 + r() * 90;
          ctx.fillStyle = hsl(34 + r() * 6, 42 + r() * 10, 66 + r() * 8);
          ctx.fillRect(x, row * rh, len, rh);
          ctx.strokeStyle = 'rgba(120,80,40,0.10)';
          for (let k = 0; k < 3; k++) {
            ctx.beginPath();
            const yy = row * rh + 4 + r() * (rh - 8);
            ctx.moveTo(x, yy);
            ctx.lineTo(x + len, yy + (r() - 0.5) * 4);
            ctx.stroke();
          }
          ctx.fillStyle = 'rgba(110,70,35,0.35)';
          ctx.fillRect(x, row * rh, 1.5, rh);
          x += len;
        }
        ctx.fillStyle = 'rgba(110,70,35,0.3)';
        ctx.fillRect(0, row * rh, w, 1.5);
      }
      noise(ctx, w, h, 0.04, 4);
    },
  },
  carpet: {
    size: 256, tile: 2, paint(ctx, w, h) {
      ctx.fillStyle = '#9cc3d6';
      ctx.fillRect(0, 0, w, h);
      noise(ctx, w, h, 0.12, 5, 2);
      ctx.strokeStyle = 'rgba(255,255,255,0.18)';
      ctx.lineWidth = 3;
      for (let i = 0; i < 4; i++) {
        ctx.beginPath();
        ctx.arc(w / 2, h / 2, 30 + i * 30, 0, Math.PI * 2);
        ctx.stroke();
      }
    },
  },
  cement_tiles: {
    size: 256, tile: 1.2, paint(ctx, w, h) {
      // French "carreaux de ciment": 4 decorated tiles.
      const t = w / 2;
      for (let i = 0; i < 2; i++) for (let j = 0; j < 2; j++) {
        const x = i * t;
        const y = j * t;
        ctx.fillStyle = '#f1eadb';
        ctx.fillRect(x, y, t, t);
        ctx.fillStyle = '#2f6f84';
        ctx.beginPath();
        ctx.moveTo(x + t / 2, y + 10);
        ctx.lineTo(x + t - 10, y + t / 2);
        ctx.lineTo(x + t / 2, y + t - 10);
        ctx.lineTo(x + 10, y + t / 2);
        ctx.closePath();
        ctx.fill();
        ctx.fillStyle = '#f1eadb';
        ctx.beginPath();
        ctx.arc(x + t / 2, y + t / 2, t * 0.22, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#d98c4a';
        ctx.beginPath();
        ctx.arc(x + t / 2, y + t / 2, t * 0.1, 0, Math.PI * 2);
        ctx.fill();
        for (const [cx, cy] of [[x, y], [x + t, y], [x, y + t], [x + t, y + t]]) {
          ctx.fillStyle = '#2f6f84';
          ctx.beginPath();
          ctx.arc(cx, cy, t * 0.16, 0, Math.PI * 2);
          ctx.fill();
        }
        ctx.strokeStyle = 'rgba(0,0,0,0.25)';
        ctx.lineWidth = 2;
        ctx.strokeRect(x, y, t, t);
      }
      noise(ctx, w, h, 0.06, 6);
    },
  },
  tomettes: {
    size: 256, tile: 1.4, paint(ctx, w, h) {
      ctx.fillStyle = '#7d3b24';
      ctx.fillRect(0, 0, w, h);
      const r = rng(31);
      const s = 21.3; // hex radius so 256 tiles seamlessly (6 columns)
      const hw = Math.sqrt(3) * s;
      for (let row = -1; row < 10; row++) {
        for (let col = -1; col < 8; col++) {
          const cx = col * hw + (row % 2 ? hw / 2 : 0);
          const cy = row * s * 1.5;
          ctx.fillStyle = hsl(12 + r() * 8, 55 + r() * 10, 42 + r() * 10);
          ctx.beginPath();
          for (let k = 0; k < 6; k++) {
            const a = Math.PI / 6 + (k * Math.PI) / 3;
            const px = cx + Math.cos(a) * (s - 1.5);
            const py = cy + Math.sin(a) * (s - 1.5);
            if (k) ctx.lineTo(px, py);
            else ctx.moveTo(px, py);
          }
          ctx.closePath();
          ctx.fill();
        }
      }
      noise(ctx, w, h, 0.08, 7);
    },
  },
  white_tiles: {
    size: 128, tile: 1.0, paint(ctx, w, h) {
      ctx.fillStyle = '#dfe8ea';
      ctx.fillRect(0, 0, w, h);
      const n = 4;
      const t = w / n;
      const r = rng(41);
      for (let i = 0; i < n; i++) for (let j = 0; j < n; j++) {
        ctx.fillStyle = hsl(190, 15, 90 + r() * 6);
        ctx.fillRect(i * t + 1.5, j * t + 1.5, t - 3, t - 3);
      }
    },
  },
  terrace: {
    size: 256, tile: 2.4, paint(ctx, w, h) {
      ctx.fillStyle = '#b9ad97';
      ctx.fillRect(0, 0, w, h);
      const r = rng(51);
      const rows = [0, 70, 150, 256];
      for (let i = 0; i < rows.length - 1; i++) {
        let x = -r() * 60;
        while (x < w) {
          const len = 60 + r() * 70;
          ctx.fillStyle = hsl(36 + r() * 10, 18 + r() * 10, 70 + r() * 10);
          ctx.fillRect(x + 2, rows[i] + 2, len - 4, rows[i + 1] - rows[i] - 4);
          x += len;
        }
      }
      noise(ctx, w, h, 0.1, 8);
    },
  },
  gravel: {
    size: 256, tile: 2.5, paint(ctx, w, h) {
      ctx.fillStyle = '#c9b99a';
      ctx.fillRect(0, 0, w, h);
      const r = rng(61);
      for (let i = 0; i < 2600; i++) {
        ctx.fillStyle = hsl(35 + r() * 15, 12 + r() * 15, 55 + r() * 30);
        ctx.beginPath();
        ctx.arc(r() * w, r() * h, 1 + r() * 2.2, 0, Math.PI * 2);
        ctx.fill();
      }
    },
  },
  pavers: {
    size: 256, tile: 2.0, paint(ctx, w, h) {
      ctx.fillStyle = '#8e8478';
      ctx.fillRect(0, 0, w, h);
      const r = rng(71);
      const bw = 64;
      const bh = 32;
      for (let row = 0; row < h / bh; row++) {
        for (let col = -1; col < w / bw + 1; col++) {
          const x = col * bw + (row % 2 ? bw / 2 : 0);
          ctx.fillStyle = hsl(20 + r() * 15, 18 + r() * 10, 58 + r() * 12);
          ctx.fillRect(x + 2, row * bh + 2, bw - 4, bh - 4);
        }
      }
      noise(ctx, w, h, 0.08, 9);
    },
  },
  asphalt: {
    size: 256, tile: 4, paint(ctx, w, h) {
      ctx.fillStyle = '#5d6168';
      ctx.fillRect(0, 0, w, h);
      noise(ctx, w, h, 0.2, 10, 2);
      noise(ctx, w, h, 0.1, 12, 1);
    },
  },
  sidewalk: {
    size: 256, tile: 2, paint(ctx, w, h) {
      ctx.fillStyle = '#c4beb4';
      ctx.fillRect(0, 0, w, h);
      noise(ctx, w, h, 0.12, 13);
      ctx.strokeStyle = 'rgba(80,70,60,0.35)';
      ctx.lineWidth = 2;
      for (let i = 0; i <= 2; i++) {
        ctx.beginPath();
        ctx.moveTo(i * (w / 2), 0);
        ctx.lineTo(i * (w / 2), h);
        ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(0, i * (h / 2));
        ctx.lineTo(w, i * (h / 2));
        ctx.stroke();
      }
    },
  },
  sand: {
    size: 256, tile: 2.5, paint(ctx, w, h) {
      ctx.fillStyle = '#e3cf9c';
      ctx.fillRect(0, 0, w, h);
      noise(ctx, w, h, 0.15, 14, 2);
    },
  },
  soil: {
    size: 256, tile: 2.0, paint(ctx, w, h) {
      ctx.fillStyle = '#6b4a32';
      ctx.fillRect(0, 0, w, h);
      noise(ctx, w, h, 0.25, 15, 3);
    },
  },
  crosswalk: {
    size: 256, tile: 3.2, paint(ctx, w, h) {
      ctx.clearRect(0, 0, w, h);
      ctx.fillStyle = '#f4f2ea';
      for (let i = 0; i < 4; i++) ctx.fillRect(i * (w / 4) + 8, 0, w / 8, h);
      noise(ctx, w, h, 0.15, 16);
    },
  },
};

const cache = new Map<string, THREE.Texture>();

export function floorTexture(kind: FloorKind, maxAniso = 4): { tex: THREE.Texture; tile: number } {
  const p = painters[kind];
  let tex = cache.get(kind);
  if (!tex) {
    const [c, ctx] = canvas(p.size, p.size);
    p.paint(ctx, p.size, p.size);
    tex = new THREE.CanvasTexture(c);
    tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
    tex.colorSpace = THREE.SRGBColorSpace;
    tex.anisotropy = maxAniso;
    cache.set(kind, tex);
  }
  return { tex, tile: p.tile };
}

/** Canvas texture with text (signs). */
export function textTexture(text: string, opts: { w?: number; h?: number; bg?: string; fg?: string; font?: string; border?: string } = {}): THREE.Texture {
  const w = opts.w ?? 512;
  const h = opts.h ?? 128;
  const [c, ctx] = canvas(w, h);
  ctx.fillStyle = opts.bg ?? '#1f4e5f';
  ctx.fillRect(0, 0, w, h);
  if (opts.border) {
    ctx.strokeStyle = opts.border;
    ctx.lineWidth = 8;
    ctx.strokeRect(6, 6, w - 12, h - 12);
  }
  ctx.fillStyle = opts.fg ?? '#f8f1e0';
  ctx.font = opts.font ?? `bold ${Math.floor(h * 0.55)}px Georgia, serif`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(text, w / 2, h / 2 + 2);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

/** Vertical sky gradient used as scene background. */
export function skyTexture(): THREE.Texture {
  const [c, ctx] = canvas(4, 256);
  const g = ctx.createLinearGradient(0, 0, 0, 256);
  g.addColorStop(0, '#6fb2e6');
  g.addColorStop(0.55, '#a9d4f0');
  g.addColorStop(1, '#f3e6cf');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 4, 256);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

/** Radial soft blob for blob shadows and splashes. */
export function blobTexture(): THREE.Texture {
  const [c, ctx] = canvas(64, 64);
  const g = ctx.createRadialGradient(32, 32, 2, 32, 32, 31);
  g.addColorStop(0, 'rgba(0,0,0,0.55)');
  g.addColorStop(0.6, 'rgba(0,0,0,0.25)');
  g.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 64, 64);
  return new THREE.CanvasTexture(c);
}

/** Paw print alpha texture. */
export function pawTexture(): THREE.Texture {
  const [c, ctx] = canvas(64, 64);
  ctx.fillStyle = '#ffffff';
  ctx.beginPath();
  ctx.ellipse(32, 40, 13, 11, 0, 0, Math.PI * 2);
  ctx.fill();
  for (const [x, y] of [[17, 22], [27, 15], [38, 15], [48, 22]]) {
    ctx.beginPath();
    ctx.ellipse(x, y, 5.5, 7, 0, 0, Math.PI * 2);
    ctx.fill();
  }
  return new THREE.CanvasTexture(c);
}

/** Simple circular gradient sprite used for particles. */
export function dotTexture(): THREE.Texture {
  const [c, ctx] = canvas(32, 32);
  const g = ctx.createRadialGradient(16, 16, 1, 16, 16, 15);
  g.addColorStop(0, 'rgba(255,255,255,1)');
  g.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 32, 32);
  return new THREE.CanvasTexture(c);
}
