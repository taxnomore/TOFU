// Lightweight particle effects (single instanced mesh, pooled).
import * as THREE from 'three';

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

export type Burst = 'dust' | 'splash' | 'mud' | 'sparkle' | 'hearts' | 'crash' | 'dirt' | 'crumbs' | 'water' | 'zoom' | 'confetti' | 'paper';

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
