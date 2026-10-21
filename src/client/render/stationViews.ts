// Dynamic visuals of the stations: what a "make" job looks like done and
// undone (bed duvet, picnic blanket, ribbon, balloons, reading cushions), the
// clothesline rope, treat jars, mailboxes and the wet soil of watered beds.
import * as THREE from 'three';
import type { GameState } from '../../shared/sim/types';
import type { GameMap } from '../../shared/world/mapTypes';
import { MakeDef, StationDef, makeDef } from '../../shared/world/types';
import { GeoBuilder, hash } from './geo';
import { materials } from './materials';

interface MakeVis {
  si: number;
  s: StationDef;
  look: MakeDef['look'];
  root: THREE.Group;
  /** 0 = made, 1 = undone (smoothed). */
  t: number;
  parts: THREE.Object3D[];
}

const BALLOON_COLORS = [0xe74c3c, 0xf1c40f, 0x3498db, 0x2ecc71, 0x9b59b6, 0xff8fab];

export class StationViews {
  readonly root = new THREE.Group();
  private makes: MakeVis[] = [];
  private wet: { si: number; m: THREE.Mesh }[] = [];
  private time = 0;

  constructor(readonly map: GameMap) {
    const mats = materials();
    const deco = new GeoBuilder();
    map.stations.forEach((s, si) => {
      switch (s.kind) {
        case 'bed':
          this.makes.push(this.buildMake(si, s));
          break;
        case 'clothesline': {
          const half = (s.hw ?? 3) + 0.4;
          deco.box(half * 2, 0.015, 0.015, { x: s.x, y: 1.83, z: s.z }, 0xf5f5f5);
          for (const sl of s.slots ?? []) deco.box(0.02, 0.06, 0.03, { x: s.x + sl[0], y: 1.81, z: s.z }, 0xe67e22);
          break;
        }
        case 'treat_jar':
          deco.cylU(0.1, 0.22, { x: s.x, y: s.y + 0.11, z: s.z }, 0xdff9fb, 12);
          deco.cylU(0.11, 0.04, { x: s.x, y: s.y + 0.24, z: s.z }, 0xc0392b, 12);
          for (let i = 0; i < 5; i++) deco.box(0.08, 0.025, 0.03, { x: s.x + (i % 2 ? 0.03 : -0.03), y: s.y + 0.04 + i * 0.035, z: s.z, ry: i }, 0xc98a3e);
          break;
        case 'mailbox':
          deco.rbox(0.4, 0.32, 0.36, 0.04, { x: s.x, y: 1.05, z: s.z }, 0x2e5e8a);
          deco.box(0.25, 0.03, 0.01, { x: s.x, y: 1.12, z: s.z - 0.185 }, 0x1b3a57);
          deco.box(0.12, 0.06, 0.01, { x: s.x, y: 0.97, z: s.z - 0.185 }, 0xffffff);
          break;
        case 'flowerbed': {
          const g = new THREE.PlaneGeometry((s.hw ?? 0.5) * 2, (s.hd ?? 0.5) * 2);
          g.rotateX(-Math.PI / 2);
          const m = new THREE.Mesh(g, new THREE.MeshPhongMaterial({ color: 0x3e2a1d, shininess: 60, transparent: true, opacity: 0.55, depthWrite: false }));
          m.position.set(s.x, s.y - 0.085, s.z);
          m.visible = false;
          this.wet.push({ si, m });
          this.root.add(m);
          break;
        }
      }
    });
    this.root.add(deco.mesh(mats.vc));
  }

  private buildMake(si: number, s: StationDef): MakeVis {
    const mats = materials();
    const look = makeDef(s).look;
    const root = new THREE.Group();
    root.position.set(s.x, 0, s.z);
    const parts: THREE.Object3D[] = [];
    const hw = s.hw ?? 0.8;
    const hd = s.hd ?? 0.8;
    const alongX = hw >= hd;
    switch (look) {
      case 'duvet': {
        const db = new GeoBuilder();
        db.rbox(1.25, 0.1, 1.82, 0.05, {}, 0xe9a3a0);
        db.box(1.27, 0.03, 0.3, { y: 0.05, x: -0.45 }, 0xffffff);
        for (let i = 0; i < 5; i++) db.sphere(0.04, { x: 0.1 + (i % 3) * 0.3, y: 0.05, z: -0.6 + i * 0.3, sy: 0.3 }, 0xffffff, 'lo');
        const m = new THREE.Mesh(db.build(), mats.vc);
        m.castShadow = true;
        parts.push(m);
        break;
      }
      case 'blanket': {
        // Gingham picnic blanket, and the same blanket rolled into a heap.
        const b = new GeoBuilder();
        const n = 8;
        const w = hw * 2;
        const d = hd * 2;
        for (let i = 0; i < n; i++) {
          for (let k = 0; k < n; k++) {
            const red = (i + k) % 2 === 0;
            b.box(w / n, 0.012, d / n, { x: -w / 2 + (i + 0.5) * (w / n), y: 0.03, z: -d / 2 + (k + 0.5) * (d / n) }, red ? 0xd63b3b : 0xfaf3ea);
          }
        }
        const flat = new THREE.Mesh(b.build(), mats.vc);
        flat.receiveShadow = true;
        const heap = new GeoBuilder();
        heap.ico(0.38, { y: 0.18, sx: 1.4, sy: 0.6 }, 0xd63b3b, 0.2);
        heap.ico(0.28, { x: 0.25, y: 0.24, z: 0.1, sy: 0.7 }, 0xfaf3ea, 0.2);
        const hm = new THREE.Mesh(heap.build(), mats.vc);
        hm.castShadow = true;
        parts.push(flat, hm);
        break;
      }
      case 'ribbon': {
        // Two brass posts with a red ribbon and a big bow.
        const posts = new GeoBuilder();
        const L = (alongX ? hw : hd) + 0.1;
        for (const e of [-1, 1]) {
          const x = alongX ? e * L : 0;
          const z = alongX ? 0 : e * L;
          posts.cylU(0.04, 1.05, { x, y: 0.525, z }, 0xd4af37, 10);
          posts.cylU(0.16, 0.04, { x, y: 0.02, z }, 0xb8962e, 14);
          posts.sphere(0.06, { x, y: 1.08, z }, 0xd4af37);
        }
        root.add(posts.mesh(mats.vc));
        const r = new GeoBuilder();
        r.box(alongX ? L * 2 : 0.02, 0.09, alongX ? 0.02 : L * 2, { y: 0.98 }, 0xd62c2c);
        for (const e of [-1, 1]) r.sphere(0.13, { x: alongX ? e * 0.12 : 0, y: 0.98, z: alongX ? 0 : e * 0.12, sx: alongX ? 1 : 0.4, sz: alongX ? 0.4 : 1, sy: 0.7 }, 0xd62c2c);
        r.sphere(0.05, { y: 0.98 }, 0xb01f1f);
        const taut = new THREE.Mesh(r.build(), mats.vc);
        const h = new GeoBuilder();
        for (const e of [-1, 1]) {
          const x = alongX ? e * (L - 0.04) : 0;
          const z = alongX ? 0 : e * (L - 0.04);
          h.box(0.02, 0.6, 0.09, { x, y: 0.7, z, ry: alongX ? 0 : Math.PI / 2, rz: e * 0.15 }, 0xd62c2c);
          h.box(0.25, 0.012, 0.09, { x: alongX ? e * (L - 0.25) : 0.1, y: 0.012, z: alongX ? 0.1 : e * (L - 0.25), ry: alongX ? 0.3 : Math.PI / 2 + 0.3 }, 0xd62c2c);
        }
        const torn = new THREE.Mesh(h.build(), mats.vc);
        parts.push(taut, torn);
        break;
      }
      case 'balloons': {
        // A bunch tied to the table, and its popped shreds.
        const g = new THREE.Group();
        for (let i = 0; i < 6; i++) {
          const b = new GeoBuilder();
          const a = (i / 6) * Math.PI * 2;
          const ox = Math.cos(a) * 0.28;
          const oz = Math.sin(a) * 0.22;
          const top = 1.85 + hash(i, 3) * 0.35;
          b.box(0.006, top - 0.75, 0.006, { x: ox * 0.5, y: (top + 0.75) / 2, z: oz * 0.5 }, 0xeeeeee);
          b.sphere(0.17, { x: ox, y: top + 0.12, z: oz, sy: 1.2 }, BALLOON_COLORS[i % BALLOON_COLORS.length], 'hi');
          const m = new THREE.Mesh(b.build(), mats.vc);
          m.castShadow = true;
          g.add(m);
        }
        const shreds = new GeoBuilder();
        for (let i = 0; i < 10; i++) {
          shreds.box(0.07, 0.008, 0.05, { x: (hash(i, 5) - 0.5) * 1.4, y: 0.01, z: (hash(i, 6) - 0.5) * 1.2, ry: i }, BALLOON_COLORS[i % BALLOON_COLORS.length]);
        }
        parts.push(g, new THREE.Mesh(shreds.build(), mats.vc));
        break;
      }
      case 'cushions': {
        const g = new THREE.Group();
        const cols = [0xf39c12, 0x16a085, 0xe74c3c, 0x8e44ad, 0x3498db];
        for (let i = 0; i < 5; i++) {
          const b = new GeoBuilder();
          b.rbox(0.62, 0.22, 0.62, 0.1, { y: 0.11 }, cols[i]);
          const m = new THREE.Mesh(b.build(), mats.vc);
          m.castShadow = true;
          m.userData.made = [Math.cos((i / 5) * Math.PI * 2) * 0.75, (i / 5) * Math.PI * 2];
          m.userData.mess = [(hash(i, 7) - 0.5) * 2.2, (hash(i, 8) - 0.5) * 2.0, hash(i, 9) * 3];
          g.add(m);
        }
        parts.push(g);
        break;
      }
    }
    for (const p of parts) root.add(p);
    this.root.add(root);
    return { si, s, look, root, t: 0, parts };
  }

  update(S: GameState, dt: number) {
    this.time += dt;
    for (const v of this.makes) {
      const made = S.stations[v.si]?.made ?? true;
      v.t += ((made ? 0 : 1) - v.t) * (1 - Math.exp(-dt * 6));
      const t = v.t;
      const s = v.s;
      switch (v.look) {
        case 'duvet': {
          // The family bed: the duvet slides off sideways when undone.
          const m = v.parts[0];
          m.position.set(0.25 + t * 0.35, 0.56 + t * 0.04, t * 0.45);
          m.rotation.set(t * 0.18, Math.PI / 2 + t * 0.5, t * -0.12);
          break;
        }
        case 'blanket': {
          const [flat, heap] = v.parts;
          flat.visible = t < 0.9;
          flat.scale.set(1 - t * 0.7, 1, 1 - t * 0.7);
          flat.rotation.y = t * 0.6;
          heap.visible = t > 0.1;
          heap.scale.setScalar(Math.max(0.01, t));
          break;
        }
        case 'ribbon': {
          const [taut, torn] = v.parts;
          taut.visible = t < 0.5;
          torn.visible = t >= 0.5;
          break;
        }
        case 'balloons': {
          const [bunch, shreds] = v.parts;
          bunch.visible = t < 0.95;
          bunch.scale.setScalar(Math.max(0.01, 1 - t));
          bunch.children.forEach((c, i) => {
            c.position.y = Math.sin(this.time * 1.3 + i) * 0.04;
            c.rotation.z = Math.sin(this.time * 0.9 + i * 2) * 0.04;
          });
          shreds.visible = t > 0.5;
          break;
        }
        case 'cushions': {
          const g = v.parts[0];
          g.children.forEach((c) => {
            const [r, a] = c.userData.made as [number, number];
            const [mx, mz, mr] = c.userData.mess as [number, number, number];
            const ax = Math.cos(a) * Math.abs(r) * (s.hw ?? 1) / 1.1;
            const az = Math.sin(a) * Math.abs(r) * (s.hd ?? 1) / 1.1;
            c.position.set(ax + (mx - ax) * t, 0, az + (mz - az) * t);
            c.rotation.set(t * 0.5 * Math.sin(mr), a + t * mr, t * 0.4 * Math.cos(mr));
          });
          break;
        }
      }
    }
    for (const w of this.wet) {
      const st = S.stations[w.si];
      w.m.visible = !!st && st.watered && !st.dug;
    }
  }

  /** Height of the dirty-paws mess drawn on this station. */
  static messY(s: StationDef): number {
    switch (makeDef(s).look) {
      case 'duvet': return 0.67;
      case 'cushions': return 0.2;
      default: return 0.03;
    }
  }
}
