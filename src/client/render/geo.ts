// Geometry builder: accumulates primitives with vertex colors and merges them
// into a single BufferGeometry (one draw call per material).
import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';

const tmpColor = new THREE.Color();
const tmpM = new THREE.Matrix4();
const tmpQ = new THREE.Quaternion();
const tmpE = new THREE.Euler();
const tmpS = new THREE.Vector3();
const tmpP = new THREE.Vector3();

export type ColorLike = number | THREE.Color;

/** Per-face colors for boxes: [+x, -x, +y, -y, +z, -z]. */
export type FaceColors = [ColorLike, ColorLike, ColorLike, ColorLike, ColorLike, ColorLike];

export interface Xform {
  x?: number;
  y?: number;
  z?: number;
  rx?: number;
  ry?: number;
  rz?: number;
  sx?: number;
  sy?: number;
  sz?: number;
}

export function matrixOf(t: Xform): THREE.Matrix4 {
  tmpE.set(t.rx ?? 0, t.ry ?? 0, t.rz ?? 0, 'YXZ');
  tmpQ.setFromEuler(tmpE);
  tmpS.set(t.sx ?? 1, t.sy ?? 1, t.sz ?? 1);
  tmpP.set(t.x ?? 0, t.y ?? 0, t.z ?? 0);
  return tmpM.compose(tmpP, tmpQ, tmpS);
}

// Shared base geometries (cloned on use).
const BASE = {
  box: new THREE.BoxGeometry(1, 1, 1),
  cyl8: new THREE.CylinderGeometry(0.5, 0.5, 1, 8),
  cyl12: new THREE.CylinderGeometry(0.5, 0.5, 1, 12),
  cyl16: new THREE.CylinderGeometry(0.5, 0.5, 1, 16),
  cone8: new THREE.ConeGeometry(0.5, 1, 8),
  cone12: new THREE.ConeGeometry(0.5, 1, 12),
  sphere: new THREE.SphereGeometry(0.5, 12, 9),
  sphereLo: new THREE.SphereGeometry(0.5, 8, 6),
  sphereHi: new THREE.SphereGeometry(0.5, 18, 12),
  ico: new THREE.IcosahedronGeometry(0.5, 1),
  torus: new THREE.TorusGeometry(0.5, 0.12, 6, 16),
  plane: new THREE.PlaneGeometry(1, 1),
};
const roundedCache = new Map<string, THREE.BufferGeometry>();
const cylCache = new Map<number, THREE.BufferGeometry>();

function strip(g: THREE.BufferGeometry): THREE.BufferGeometry {
  const out = g.index ? g.toNonIndexed() : g.clone();
  out.deleteAttribute('uv');
  if (out.getAttribute('uv1')) out.deleteAttribute('uv1');
  return out;
}

function paint(g: THREE.BufferGeometry, color: ColorLike, jitter = 0, seed = 0): void {
  const n = g.getAttribute('position').count;
  const arr = new Float32Array(n * 3);
  tmpColor.set(color as THREE.ColorRepresentation);
  for (let i = 0; i < n; i++) {
    let r = tmpColor.r;
    let gg = tmpColor.g;
    let b = tmpColor.b;
    if (jitter > 0) {
      const k = 1 + (hash(i / 3 | 0, seed) - 0.5) * jitter;
      r *= k;
      gg *= k;
      b *= k;
    }
    arr[i * 3] = r;
    arr[i * 3 + 1] = gg;
    arr[i * 3 + 2] = b;
  }
  g.setAttribute('color', new THREE.BufferAttribute(arr, 3));
}

export function hash(i: number, seed = 0): number {
  let h = (i * 374761393 + seed * 668265263) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  h ^= h >>> 16;
  return (h >>> 0) / 4294967296;
}

export class GeoBuilder {
  private parts: THREE.BufferGeometry[] = [];

  get empty(): boolean {
    return this.parts.length === 0;
  }

  /** Adds an arbitrary geometry (cloned) with a uniform color. */
  addGeo(g: THREE.BufferGeometry, t: Xform, color: ColorLike, jitter = 0): this {
    const c = strip(g);
    c.applyMatrix4(matrixOf(t));
    paint(c, color, jitter, this.parts.length);
    this.parts.push(c);
    return this;
  }

  /** Adds a geometry already in world space with an existing color attribute. */
  addRaw(g: THREE.BufferGeometry): this {
    this.parts.push(g);
    return this;
  }

  box(w: number, h: number, d: number, t: Xform, color: ColorLike, jitter = 0): this {
    return this.addGeo(BASE.box, { ...t, sx: w * (t.sx ?? 1), sy: h * (t.sy ?? 1), sz: d * (t.sz ?? 1) }, color, jitter);
  }

  /** Box with explicit bounds (axis aligned). */
  boxAt(x0: number, y0: number, z0: number, x1: number, y1: number, z1: number, color: ColorLike): this {
    return this.box(x1 - x0, y1 - y0, z1 - z0, { x: (x0 + x1) / 2, y: (y0 + y1) / 2, z: (z0 + z1) / 2 }, color);
  }

  /** Axis aligned box with one color per face: [+x, -x, +y, -y, +z, -z]. */
  boxFaces(x0: number, y0: number, z0: number, x1: number, y1: number, z1: number, colors: FaceColors): this {
    const g = BASE.box.clone().toNonIndexed();
    g.deleteAttribute('uv');
    g.applyMatrix4(matrixOf({ x: (x0 + x1) / 2, y: (y0 + y1) / 2, z: (z0 + z1) / 2, sx: x1 - x0, sy: y1 - y0, sz: z1 - z0 }));
    const n = g.getAttribute('position').count; // 36 vertices, 6 per face
    const arr = new Float32Array(n * 3);
    for (let f = 0; f < 6; f++) {
      tmpColor.set(colors[f] as THREE.ColorRepresentation);
      for (let v = 0; v < 6; v++) {
        const i = f * 6 + v;
        arr[i * 3] = tmpColor.r;
        arr[i * 3 + 1] = tmpColor.g;
        arr[i * 3 + 2] = tmpColor.b;
      }
    }
    g.setAttribute('color', new THREE.BufferAttribute(arr, 3));
    this.parts.push(g);
    return this;
  }

  rbox(w: number, h: number, d: number, r: number, t: Xform, color: ColorLike, seg = 2): this {
    const key = `${w.toFixed(3)}|${h.toFixed(3)}|${d.toFixed(3)}|${r.toFixed(3)}|${seg}`;
    let g = roundedCache.get(key);
    if (!g) {
      g = new RoundedBoxGeometry(w, h, d, seg, Math.min(r, w / 2 - 1e-3, h / 2 - 1e-3, d / 2 - 1e-3));
      roundedCache.set(key, g);
    }
    return this.addGeo(g, t, color);
  }

  cyl(rTop: number, rBot: number, h: number, t: Xform, color: ColorLike, seg = 12): this {
    const g = new THREE.CylinderGeometry(rTop, rBot, h, seg);
    this.addGeo(g, t, color);
    g.dispose();
    return this;
  }

  cylU(r: number, h: number, t: Xform, color: ColorLike, seg = 12): this {
    let base = seg === 8 ? BASE.cyl8 : seg === 16 ? BASE.cyl16 : seg === 12 ? BASE.cyl12 : cylCache.get(seg);
    if (!base) {
      base = new THREE.CylinderGeometry(0.5, 0.5, 1, seg);
      cylCache.set(seg, base);
    }
    return this.addGeo(base, { ...t, sx: r * 2 * (t.sx ?? 1), sy: h * (t.sy ?? 1), sz: r * 2 * (t.sz ?? 1) }, color);
  }

  cone(r: number, h: number, t: Xform, color: ColorLike, seg: 8 | 12 = 8): this {
    return this.addGeo(seg === 8 ? BASE.cone8 : BASE.cone12, { ...t, sx: r * 2, sy: h, sz: r * 2 }, color);
  }

  sphere(r: number, t: Xform, color: ColorLike, detail: 'lo' | 'mid' | 'hi' = 'mid'): this {
    const base = detail === 'lo' ? BASE.sphereLo : detail === 'hi' ? BASE.sphereHi : BASE.sphere;
    return this.addGeo(base, { ...t, sx: r * 2 * (t.sx ?? 1), sy: r * 2 * (t.sy ?? 1), sz: r * 2 * (t.sz ?? 1) }, color);
  }

  ico(r: number, t: Xform, color: ColorLike, jitter = 0): this {
    return this.addGeo(BASE.ico, { ...t, sx: r * 2 * (t.sx ?? 1), sy: r * 2 * (t.sy ?? 1), sz: r * 2 * (t.sz ?? 1) }, color, jitter);
  }

  torus(r: number, tube: number, t: Xform, color: ColorLike): this {
    const g = new THREE.TorusGeometry(r, tube, 6, 18);
    this.addGeo(g, t, color);
    g.dispose();
    return this;
  }

  /** Flat horizontal quad (y up). */
  quad(w: number, d: number, t: Xform, color: ColorLike): this {
    return this.addGeo(BASE.plane, { ...t, rx: -Math.PI / 2 + (t.rx ?? 0), sx: w, sy: d }, color);
  }

  /** Flat disc on the ground. */
  disc(r: number, t: Xform, color: ColorLike, seg = 16): this {
    const g = new THREE.CircleGeometry(r, seg);
    this.addGeo(g, { ...t, rx: -Math.PI / 2 }, color);
    g.dispose();
    return this;
  }

  /** Extruded 2D shape (points in local x/y), extruded along z by depth. */
  extrude(pts: [number, number][], depth: number, t: Xform, color: ColorLike, bevel = 0): this {
    const shape = new THREE.Shape(pts.map(([x, y]) => new THREE.Vector2(x, y)));
    const g = new THREE.ExtrudeGeometry(shape, {
      depth, bevelEnabled: bevel > 0, bevelSize: bevel, bevelThickness: bevel, bevelSegments: 1, curveSegments: 6,
    });
    g.translate(0, 0, -depth / 2);
    this.addGeo(g, t, color);
    g.dispose();
    return this;
  }

  /** Custom triangles from explicit vertices, single color. Double-sided by default (winding-proof). */
  tris(verts: number[], color: ColorLike, doubleSided = true): this {
    const all = verts.slice();
    if (doubleSided) {
      for (let i = 0; i < verts.length; i += 9) {
        all.push(verts[i], verts[i + 1], verts[i + 2], verts[i + 6], verts[i + 7], verts[i + 8], verts[i + 3], verts[i + 4], verts[i + 5]);
      }
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(all, 3));
    g.computeVertexNormals();
    paint(g, color);
    this.parts.push(g);
    return this;
  }

  /** Quad from 4 corner points (a,b,c,d in order), double-sided. */
  quad4(a: number[], b: number[], c: number[], d: number[], color: ColorLike): this {
    return this.tris([...a, ...b, ...c, ...a, ...c, ...d], color);
  }

  build(): THREE.BufferGeometry {
    if (!this.parts.length) return new THREE.BufferGeometry();
    const merged = mergeGeometries(this.parts, false);
    for (const p of this.parts) p.dispose();
    this.parts = [];
    if (!merged) throw new Error('mergeGeometries failed');
    merged.computeBoundingSphere();
    merged.computeBoundingBox();
    return merged;
  }

  mesh(material: THREE.Material, shadows = true): THREE.Mesh {
    const m = new THREE.Mesh(this.build(), material);
    m.castShadow = shadows;
    m.receiveShadow = true;
    return m;
  }
}

export function color(hex: number): THREE.Color {
  return new THREE.Color(hex);
}

/** Multiplies a hex color brightness. */
export function shade(hex: number, k: number): THREE.Color {
  const c = new THREE.Color(hex);
  c.r = Math.min(1, c.r * k);
  c.g = Math.min(1, c.g * k);
  c.b = Math.min(1, c.b * k);
  return c;
}

export function mix(a: number, b: number, t: number): THREE.Color {
  return new THREE.Color(a).lerp(new THREE.Color(b), t);
}
