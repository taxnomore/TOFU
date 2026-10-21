// Lightweight particle effects (single instanced mesh, pooled).
import * as THREE from 'three';
import { dotTexture } from './textures';

const MAX = 420;

interface P {
  alive: boolean;
  x: number;
  y: number;
  z: number;
  vx: number;
  vy: number;
  vz: number;
  life: number;
  max: number;
  size: number;
  grav: number;
  color: THREE.Color;
  grow: number;
}

export type Burst = 'dust' | 'splash' | 'mud' | 'sparkle' | 'hearts' | 'crash' | 'dirt' | 'crumbs' | 'water' | 'zoom' | 'confetti' | 'paper' | 'leaves' | 'snow';

const LEAF_COLORS = [0xd35400, 0xe67e22, 0xeba524, 0xc0392b, 0xd4a017];

export class Effects {
  readonly mesh: THREE.InstancedMesh;
  private ps: P[] = [];
  private m = new THREE.Matrix4();
  private q = new THREE.Quaternion();
  private s = new THREE.Vector3();
  private v = new THREE.Vector3();

  constructor(scene: THREE.Scene) {
    const g = new THREE.IcosahedronGeometry(0.5, 0);
    const mat = new THREE.MeshBasicMaterial({ color: 0xffffff });
    this.mesh = new THREE.InstancedMesh(g, mat, MAX);
    this.mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    this.mesh.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(MAX * 3), 3);
    this.mesh.frustumCulled = false;
    this.mesh.count = 0;
    scene.add(this.mesh);
    for (let i = 0; i < MAX; i++) {
      this.ps.push({ alive: false, x: 0, y: 0, z: 0, vx: 0, vy: 0, vz: 0, life: 0, max: 1, size: 0.1, grav: 0, color: new THREE.Color(), grow: 0 });
    }
  }

  private spawn(x: number, y: number, z: number, vx: number, vy: number, vz: number, life: number, size: number, color: number, grav: number, grow = 0) {
    const p = this.ps.find((q) => !q.alive);
    if (!p) return;
    p.alive = true;
    p.x = x;
    p.y = y;
    p.z = z;
    p.vx = vx;
    p.vy = vy;
    p.vz = vz;
    p.life = life;
    p.max = life;
    p.size = size;
    p.grav = grav;
    p.color.setHex(color);
    p.grow = grow;
  }

  burst(kind: Burst, x: number, y: number, z: number, n = 10, dirX = 0, dirZ = 0) {
    const r = Math.random;
    for (let i = 0; i < n; i++) {
      const a = r() * Math.PI * 2;
      const sp = r();
      switch (kind) {
        case 'dust':
          this.spawn(x + (r() - 0.5) * 0.3, y + 0.05, z + (r() - 0.5) * 0.3, Math.cos(a) * 0.5 - dirX * 0.8, 0.4 + r() * 0.5, Math.sin(a) * 0.5 - dirZ * 0.8, 0.5 + r() * 0.3, 0.14 + r() * 0.1, r() < 0.5 ? 0xd9c7a6 : 0xc8b38f, -0.3, 0.5);
          break;
        case 'zoom':
          this.spawn(x, y + 0.1 + r() * 0.3, z, -dirX * (2 + sp * 2) + (r() - 0.5), 0.2 + r() * 0.4, -dirZ * (2 + sp * 2) + (r() - 0.5), 0.35, 0.09 + r() * 0.06, r() < 0.5 ? 0xffffff : 0xfff2b0, 0, 0.2);
          break;
        case 'splash':
        case 'mud':
          this.spawn(x, y + 0.05, z, Math.cos(a) * (1 + sp * 2), 2 + r() * 2.5, Math.sin(a) * (1 + sp * 2), 0.6, 0.06 + r() * 0.05, kind === 'mud' ? (r() < 0.5 ? 0x6b4a32 : 0x5a3b26) : 0x8fd3f5, 9);
          break;
        case 'water':
          this.spawn(x, y + 0.2, z, Math.cos(a) * sp * 1.5, 1 + r() * 2, Math.sin(a) * sp * 1.5, 0.7, 0.05 + r() * 0.04, 0x8fd3f5, 9);
          break;
        case 'sparkle':
          this.spawn(x + (r() - 0.5) * 0.6, y + 0.2 + r() * 0.6, z + (r() - 0.5) * 0.6, (r() - 0.5) * 0.5, 0.8 + r(), (r() - 0.5) * 0.5, 0.7 + r() * 0.4, 0.07 + r() * 0.05, r() < 0.4 ? 0xfff3a3 : r() < 0.7 ? 0xffffff : 0x9be7ff, -0.5);
          break;
        case 'hearts':
          this.spawn(x + (r() - 0.5) * 0.4, y + r() * 0.3, z + (r() - 0.5) * 0.4, (r() - 0.5) * 0.3, 0.9 + r() * 0.5, (r() - 0.5) * 0.3, 1.1, 0.09 + r() * 0.04, 0xff6b9a, -0.2);
          break;
        case 'crash':
          this.spawn(x, y + 0.2, z, Math.cos(a) * (1 + sp * 3), 1.5 + r() * 3, Math.sin(a) * (1 + sp * 3), 0.8, 0.05 + r() * 0.05, r() < 0.5 ? 0xffffff : 0xd9c7a6, 10);
          break;
        case 'dirt':
          this.spawn(x, y + 0.1, z, Math.cos(a) * (0.5 + sp), 2 + r() * 2, Math.sin(a) * (0.5 + sp), 0.7, 0.06 + r() * 0.05, r() < 0.5 ? 0x6b4a32 : 0x8a6a4a, 10);
          break;
        case 'crumbs':
          this.spawn(x, y + 0.4, z, Math.cos(a) * sp, 1 + r() * 1.5, Math.sin(a) * sp, 0.6, 0.035 + r() * 0.03, 0xe0b06a, 9);
          break;
        case 'paper':
          this.spawn(x, y + 0.3, z, Math.cos(a) * sp * 1.5, 1.5 + r() * 2, Math.sin(a) * sp * 1.5, 0.9, 0.06, r() < 0.5 ? 0xffffff : 0xf9ca24, 6);
          break;
        case 'leaves':
          this.spawn(x, y + 0.2, z, Math.cos(a) * (0.6 + sp * 1.6), 1.6 + r() * 2.2, Math.sin(a) * (0.6 + sp * 1.6), 1.3 + r() * 0.6, 0.07 + r() * 0.04, LEAF_COLORS[i % LEAF_COLORS.length], 3);
          break;
        case 'snow':
          this.spawn(x, y + 0.3, z, Math.cos(a) * (0.5 + sp * 2), 1.5 + r() * 2.5, Math.sin(a) * (0.5 + sp * 2), 0.8, 0.07 + r() * 0.07, r() < 0.7 ? 0xffffff : 0xdfe9f3, 9);
          break;
        case 'confetti': {
          const cols = [0xff6b6b, 0xfeca57, 0x48dbfb, 0x1dd1a1, 0xff9ff3, 0xffffff];
          this.spawn(x + (r() - 0.5) * 3, y + 2 + r() * 2, z + (r() - 0.5) * 3, (r() - 0.5) * 2, 1 + r() * 3, (r() - 0.5) * 2, 2.2, 0.06 + r() * 0.05, cols[i % cols.length], 3);
          break;
        }
      }
    }
  }

  update(dt: number) {
    let n = 0;
    const col = this.mesh.instanceColor!;
    for (const p of this.ps) {
      if (!p.alive) continue;
      p.life -= dt;
      if (p.life <= 0) {
        p.alive = false;
        continue;
      }
      p.vy -= p.grav * dt;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.z += p.vz * dt;
      if (p.y < 0.02) {
        p.y = 0.02;
        p.vy *= -0.2;
        p.vx *= 0.6;
        p.vz *= 0.6;
      }
      const t = p.life / p.max;
      const sc = p.size * (t < 0.3 ? t / 0.3 : 1) * (1 + (1 - t) * p.grow);
      this.s.setScalar(sc);
      this.m.compose(this.v.set(p.x, p.y, p.z), this.q, this.s);
      this.mesh.setMatrixAt(n, this.m);
      col.setXYZ(n, p.color.r, p.color.g, p.color.b);
      n++;
    }
    this.mesh.count = n;
    this.mesh.instanceMatrix.needsUpdate = true;
    col.needsUpdate = true;
  }
}

/**
 * Weather of the ambiance around the viewers: snowflakes in winter, falling
 * leaves in autumn. Particles wrap around a box that follows the players.
 */
export class Weather {
  private points: THREE.Points;
  private pos: Float32Array;
  private phase: Float32Array;
  private kind: 'none' | 'snow' | 'leaves' = 'none';
  private t = 0;
  private readonly n: number;
  private static readonly BOX = 48;
  private static readonly H = 14;

  constructor(scene: THREE.Scene, quality: 'high' | 'medium' | 'low') {
    this.n = quality === 'low' ? 450 : quality === 'medium' ? 800 : 1200;
    this.pos = new Float32Array(this.n * 3);
    this.phase = new Float32Array(this.n);
    const col = new Float32Array(this.n * 3);
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(this.pos, 3));
    g.setAttribute('color', new THREE.BufferAttribute(col, 3));
    const mat = new THREE.PointsMaterial({ size: 0.13, map: dotTexture(), vertexColors: true, transparent: true, depthWrite: false, opacity: 0.95, alphaTest: 0.05 });
    this.points = new THREE.Points(g, mat);
    this.points.frustumCulled = false;
    this.points.visible = false;
    scene.add(this.points);
  }

  set(kind: 'none' | 'snow' | 'leaves') {
    this.kind = kind;
    this.points.visible = kind !== 'none';
    if (kind === 'none') return;
    const mat = this.points.material as THREE.PointsMaterial;
    mat.size = kind === 'snow' ? 0.2 : 0.3;
    const col = this.points.geometry.getAttribute('color') as THREE.BufferAttribute;
    const c = new THREE.Color();
    const B = Weather.BOX;
    // Leaves: only a few, slowly twirling down.
    const live = kind === 'snow' ? this.n : Math.floor(this.n / 6);
    this.points.geometry.setDrawRange(0, live);
    for (let i = 0; i < this.n; i++) {
      this.pos[i * 3] = (Math.random() - 0.5) * B;
      this.pos[i * 3 + 1] = Math.random() * Weather.H;
      this.pos[i * 3 + 2] = (Math.random() - 0.5) * B;
      this.phase[i] = Math.random() * Math.PI * 2;
      c.setHex(kind === 'snow' ? (i % 5 ? 0xffffff : 0xdce8f5) : LEAF_COLORS[i % LEAF_COLORS.length]);
      col.setXYZ(i, c.r, c.g, c.b);
    }
    col.needsUpdate = true;
  }

  update(dt: number, cx: number, cz: number) {
    if (this.kind === 'none') return;
    this.t += dt;
    const B = Weather.BOX;
    const half = B / 2;
    const fall = this.kind === 'snow' ? 1.1 : 0.7;
    const sway = this.kind === 'snow' ? 0.35 : 1.1;
    const p = this.pos;
    for (let i = 0; i < this.n; i++) {
      const k = i * 3;
      const ph = this.phase[i];
      p[k] += Math.sin(this.t * 0.9 + ph) * sway * dt;
      p[k + 1] -= fall * (0.75 + (ph % 1) * 0.5) * dt;
      p[k + 2] += Math.cos(this.t * 0.7 + ph * 1.3) * sway * 0.6 * dt;
      if (p[k + 1] < 0) p[k + 1] += Weather.H;
      // Keep the flakes in a box around the viewers (wrap around).
      if (p[k] - cx > half) p[k] -= B;
      else if (p[k] - cx < -half) p[k] += B;
      if (p[k + 2] - cz > half) p[k + 2] -= B;
      else if (p[k + 2] - cz < -half) p[k + 2] += B;
    }
    (this.points.geometry.getAttribute('position') as THREE.BufferAttribute).needsUpdate = true;
  }
}
