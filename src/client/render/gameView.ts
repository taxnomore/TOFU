// Synchronizes dynamic 3D objects (characters, items, doors, messes, treats,
// cat, mail carrier, station states) with the simulation state.
import * as THREE from 'three';
import type { GameState, Item } from '../../shared/sim/types';
import { Anim } from '../../shared/sim/types';
import { ITEM_TYPES } from '../../shared/world/itemTypes';
import { DOORS, STATIONS } from '../../shared/world/map';
import { CatModel, DogModel, HumanModel } from './characters';
import { GeoBuilder } from './geo';
import { buildItemGeometry, buildMessGeometry, buildSetTableGeometry, treatGeometry, waterGeometry } from './itemModels';
import { materials } from './materials';
import { pawTexture } from './textures';

/** Positions captured before the latest simulation step (for render interpolation). */
export interface PrevSnapshot {
  chars: number[];
  cat: number[];
  items: number[];
}

export function captureSnapshot(S: GameState, out?: PrevSnapshot): PrevSnapshot {
  const o = out ?? { chars: [], cat: [], items: [] };
  o.chars.length = 0;
  for (const c of S.chars) o.chars.push(c.x, c.z);
  o.cat = [S.cat.x, S.cat.y, S.cat.z];
  o.items.length = 0;
  for (const it of S.items) o.items.push(it.x, it.y, it.z);
  return o;
}

const HIDDEN_KINDS = new Set(['hamper', 'dresser', 'toybox', 'mailbox', 'cupboard', 'street_bin']);
const MAX_PRINTS = 900;

interface DoorVis {
  pivots: THREE.Group[];
  sign: number[];
  angle: number;
  flap?: THREE.Group;
  slide?: THREE.Group[];
}

export class GameView {
  readonly root = new THREE.Group();
  dog: DogModel;
  humans = new Map<number, HumanModel>();
  cat = new CatModel();
  carrier = new HumanModel(4);
  private items: THREE.Mesh[] = [];
  private setTable: THREE.Mesh;
  private doors: DoorVis[] = [];
  private messes = new Map<number, { obj: THREE.Object3D; rev: number }>();
  private prints: THREE.InstancedMesh;
  private printsKey = '';
  private treats: THREE.Mesh[] = [];
  private duvet: THREE.Mesh;
  private duvetT = 0;
  private wet: THREE.Mesh[] = [];
  private tmpV = new THREE.Vector3();
  private tmpM = new THREE.Matrix4();
  private tmpQ = new THREE.Quaternion();
  private highlight: THREE.Mesh[] = [];
  time = 0;

  constructor(scene: THREE.Scene, S: GameState) {
    scene.add(this.root);
    const mats = materials();
    this.dog = new DogModel();
    this.root.add(this.dog.root);
    for (const c of S.chars) {
      if (c.role === 'human') {
        const h = new HumanModel(c.avatar);
        this.humans.set(c.id, h);
        this.root.add(h.root);
      }
    }
    this.root.add(this.cat.root);
    this.root.add(this.carrier.root);
    this.carrier.root.visible = false;

    // Items.
    for (const it of S.items) {
      const m = new THREE.Mesh(buildItemGeometry(it.type, it.idx), mats.vc);
      m.castShadow = true;
      this.items[it.idx] = m;
      this.root.add(m);
    }
    this.setTable = new THREE.Mesh(buildSetTableGeometry(), mats.vc);
    this.setTable.visible = false;
    this.root.add(this.setTable);

    // Doors.
    DOORS.forEach((d) => this.doors.push(this.buildDoor(d)));

    // Paw prints.
    const pg = new THREE.PlaneGeometry(0.17, 0.17);
    pg.rotateX(-Math.PI / 2);
    const pm = new THREE.MeshBasicMaterial({ color: 0x5b3a22, map: pawTexture(), transparent: true, depthWrite: false, opacity: 0.88, polygonOffset: true, polygonOffsetFactor: -2 });
    this.prints = new THREE.InstancedMesh(pg, pm, MAX_PRINTS);
    this.prints.count = 0;
    this.prints.frustumCulled = false;
    this.prints.renderOrder = 1;
    this.root.add(this.prints);

    // Treats pool.
    const tg = treatGeometry();
    for (let i = 0; i < 9; i++) {
      const m = new THREE.Mesh(tg, mats.vc);
      m.visible = false;
      this.treats.push(m);
      this.root.add(m);
    }

    // Bed duvet (made / unmade).
    const bed = STATIONS.find((s) => s.id === 'lit')!;
    const db = new GeoBuilder();
    db.rbox(1.25, 0.1, 1.82, 0.05, {}, 0xe9a3a0);
    db.box(1.27, 0.03, 0.3, { y: 0.05, x: -0.45 }, 0xffffff);
    for (let i = 0; i < 5; i++) db.sphere(0.04, { x: 0.1 + (i % 3) * 0.3, y: 0.05, z: -0.6 + i * 0.3, sy: 0.3 }, 0xffffff, 'lo');
    this.duvet = new THREE.Mesh(db.build(), mats.vc);
    this.duvet.castShadow = true;
    this.duvet.position.set(bed.x + 0.25, 0.56, bed.z);
    this.duvet.rotation.y = Math.PI / 2;
    this.root.add(this.duvet);

    // Clothesline rope + pins.
    const line = STATIONS.find((s) => s.id === 'fil_linge')!;
    const rb = new GeoBuilder();
    rb.box(6.8, 0.015, 0.015, { x: line.x, y: 1.83, z: line.z }, 0xf5f5f5);
    for (const sl of line.slots ?? []) rb.box(0.02, 0.06, 0.03, { x: line.x + sl[0], y: 1.81, z: line.z }, 0xe67e22);
    this.root.add(rb.mesh(mats.vc, false));

    // Treat jar and family mailbox decor.
    const jar = STATIONS.find((s) => s.id === 'bocal')!;
    const jb = new GeoBuilder();
    jb.cylU(0.1, 0.22, { x: jar.x, y: jar.y + 0.11, z: jar.z }, 0xdff9fb, 12);
    jb.cylU(0.11, 0.04, { x: jar.x, y: jar.y + 0.24, z: jar.z }, 0xc0392b, 12);
    for (let i = 0; i < 5; i++) jb.box(0.08, 0.025, 0.03, { x: jar.x + (i % 2 ? 0.03 : -0.03), y: jar.y + 0.04 + i * 0.035, z: jar.z, ry: i }, 0xc98a3e);
    const mb = STATIONS.find((s) => s.id === 'boite_lettres')!;
    jb.rbox(0.4, 0.32, 0.36, 0.04, { x: mb.x, y: 1.05, z: mb.z }, 0x2e5e8a);
    jb.box(0.25, 0.03, 0.01, { x: mb.x, y: 1.12, z: mb.z - 0.185 }, 0x1b3a57);
    jb.box(0.12, 0.06, 0.01, { x: mb.x, y: 0.97, z: mb.z - 0.185 }, 0xffffff);
    this.root.add(jb.mesh(mats.vc));

    // Wet soil overlays for the flowerbeds.
    for (const id of ['massif_est', 'massif_sud']) {
      const s = STATIONS.find((q) => q.id === id)!;
      const g = new THREE.PlaneGeometry((s.hw ?? 0.5) * 2, (s.hd ?? 0.5) * 2);
      g.rotateX(-Math.PI / 2);
      const m = new THREE.Mesh(g, new THREE.MeshPhongMaterial({ color: 0x3e2a1d, shininess: 60, transparent: true, opacity: 0.55, depthWrite: false }));
      m.position.set(s.x, 0.115, s.z);
      m.visible = false;
      this.wet.push(m);
      this.root.add(m);
    }

    // Interaction highlight rings (one per local player, created on demand).
  }

  private buildDoor(d: (typeof DOORS)[number]): DoorVis {
    const mats = materials();
    const vis: DoorVis = { pivots: [], sign: [], angle: d.open ? 1 : 0 };
    const along = d.axis === 'x';
    const H = d.kind === 'gate' ? (d.id === 'portail' ? 1.3 : 1.25) : 2.12;
    const leafs = d.kind === 'gate' ? 2 : 1;
    if (d.kind === 'bay') {
      // Two sliding glass panels.
      vis.slide = [];
      for (let i = 0; i < 2; i++) {
        const g = new THREE.Group();
        const b = new GeoBuilder();
        const w = d.width / 2;
        b.box(w, 0.06, 0.06, { y: 2.08 }, 0xffffff);
        b.box(w, 0.06, 0.06, { y: 0.03 }, 0xffffff);
        b.box(0.06, 2.1, 0.06, { x: -w / 2 + 0.03, y: 1.05 }, 0xffffff);
        b.box(0.06, 2.1, 0.06, { x: w / 2 - 0.03, y: 1.05 }, 0xffffff);
        const frame = b.mesh(mats.vcCut);
        g.add(frame);
        const gb = new GeoBuilder();
        gb.box(w - 0.08, 2.0, 0.02, { y: 1.05 }, 0xffffff);
        g.add(gb.mesh(mats.glassCut, false));
        g.position.set(d.x + (i === 0 ? -w / 2 : w / 2), 0, d.z + (i === 0 ? -0.05 : 0.05));
        if (!along) g.rotation.y = Math.PI / 2;
        vis.slide.push(g);
        this.root.add(g);
      }
      return vis;
    }
    for (let li = 0; li < leafs; li++) {
      const hingeSide = leafs === 2 ? (li === 0 ? -1 : 1) : d.hinge;
      const w = d.width / leafs;
      const pivot = new THREE.Group();
      const hx = along ? d.x + hingeSide * d.width / 2 : d.x;
      const hz = along ? d.z : d.z + hingeSide * d.width / 2;
      pivot.position.set(hx, 0, hz);
      const b = new GeoBuilder();
      const dir = -hingeSide; // leaf extends from the hinge toward the other side
      const lx = along ? dir * w / 2 : 0;
      const lz = along ? 0 : dir * w / 2;
      const ry = along ? 0 : Math.PI / 2;
      const col = d.color ?? 0xf4efe4;
      if (d.kind === 'gate') {
        const n = Math.round(w / 0.14);
        for (let i = 0; i < n; i++) {
          const o = dir * (0.07 + i * (w - 0.1) / n);
          const top = d.id === 'portail' ? H - Math.abs(Math.sin(((i + 0.5) / n) * Math.PI)) * 0.25 : H;
          b.box(d.id === 'portail' ? 0.04 : 0.1, top, 0.04, { x: along ? o : 0, y: top / 2, z: along ? 0 : o, ry }, col);
        }
        b.box(w, 0.08, 0.05, { x: lx, y: 0.3, z: lz, ry }, col);
        b.box(w, 0.08, 0.05, { x: lx, y: H - 0.35, z: lz, ry }, col);
      } else {
        b.box(w - 0.03, H, 0.05, { x: lx, y: H / 2, z: lz, ry }, col);
        // Panels.
        for (const yy of [0.55, 1.5]) {
          for (const s of [-1, 1]) {
            b.box(w * 0.7, 0.55, 0.012, { x: lx, y: yy, z: lz + (along ? s * 0.03 : 0), ry: ry, sx: 1 }, shadeHex(col, 0.93));
            if (!along) b.box(0.012, 0.55, w * 0.7, { x: lx + s * 0.03, y: yy, z: lz }, shadeHex(col, 0.93));
          }
        }
        const kx = along ? dir * (w - 0.12) : 0;
        const kz = along ? 0 : dir * (w - 0.12);
        for (const s of [-1, 1]) {
          b.sphere(0.035, { x: kx + (along ? 0 : s * 0.05), y: 1.0, z: kz + (along ? s * 0.05 : 0) }, 0xd4af37);
        }
        if (d.kind === 'exterior') {
          b.box(w * 0.5, 0.45, 0.06, { x: lx, y: 1.6, z: lz, ry }, 0xcfeaf6);
        }
      }
      const leaf = b.mesh(d.kind === 'gate' ? mats.vc : mats.vcCut);
      pivot.add(leaf);
      if (d.dogFlap) {
        const fl = new THREE.Group();
        const fx = along ? dir * w / 2 : 0;
        const fz = along ? 0 : dir * w / 2;
        fl.position.set(fx, 0.62, fz);
        const fb = new GeoBuilder();
        fb.box(0.42, 0.45, 0.07, { y: -0.23, ry }, 0x3d3d3d);
        fb.box(0.36, 0.38, 0.075, { y: -0.23, ry }, 0x6b6b6b);
        fl.add(fb.mesh(mats.vc));
        pivot.add(fl);
        vis.flap = fl;
      }
      const sign = along ? d.swing * hingeSide : -d.swing * hingeSide;
      vis.pivots.push(pivot);
      vis.sign.push(sign);
      this.root.add(pivot);
    }
    return vis;
  }

  /** Updates all dynamic visuals. alpha interpolates between prev and current state. */
  sync(S: GameState, dt: number, alpha = 1, prev?: PrevSnapshot) {
    this.time += dt;
    const lerp = (a: number, b: number) => a + (b - a) * alpha;
    // Characters.
    for (const c of S.chars) {
      const px = prev && prev.chars.length > c.id * 2 ? lerp(prev.chars[c.id * 2], c.x) : c.x;
      const pz = prev && prev.chars.length > c.id * 2 ? lerp(prev.chars[c.id * 2 + 1], c.z) : c.z;
      const view = { ...c, x: px, z: pz };
      if (c.role === 'tofu') this.dog.update(view, dt, false);
      else this.humans.get(c.id)?.update(view, dt);
    }
    const cat = prev ? { ...S.cat, x: lerp(prev.cat[0], S.cat.x), y: lerp(prev.cat[1], S.cat.y), z: lerp(prev.cat[2], S.cat.z) } : S.cat;
    this.cat.update(cat, dt);
    const car = S.carrier;
    this.carrier.root.visible = car.active;
    if (car.active) {
      this.carrier.update({ x: car.x, z: car.z, facing: car.facing, speed: car.wait > 0 ? 0 : 1.3, anim: car.wait > 0 ? Anim.Idle : car.scared > 0 ? Anim.Run : Anim.Walk, animT: car.t, hold: [], stun: 0 }, dt);
    }

    // Items.
    const tofu = S.chars.find((c) => c.role === 'tofu')!;
    for (const it of S.items) this.syncItem(S, it, tofu.id, alpha, prev);

    // Doors.
    S.doors.forEach((ds, i) => {
      const v = this.doors[i];
      const target = ds.open ? 1 : 0;
      v.angle += (target - v.angle) * (1 - Math.exp(-dt * 9));
      if (v.slide) {
        const w = DOORS[i].width / 2;
        const along = DOORS[i].axis === 'x';
        v.slide.forEach((g, k) => {
          const base = k === 0 ? -w / 2 : w / 2;
          const off = (k === 0 ? -1 : 1) * v.angle * (w - 0.1);
          if (along) g.position.x = DOORS[i].x + base + off;
          else g.position.z = DOORS[i].z + base + off;
        });
      }
      v.pivots.forEach((p, k) => {
        p.rotation.y = v.sign[k] * v.angle * (Math.PI / 2) * 0.97;
      });
      if (v.flap) {
        const dd = Math.hypot(tofu.x - DOORS[i].x, tofu.z - DOORS[i].z);
        const swing = dd < 0.7 ? Math.sin(this.time * 18) * 0.6 * (1 - dd / 0.7) : 0;
        v.flap.rotation.x += (swing - v.flap.rotation.x) * 0.3;
      }
    });

    // Bed duvet.
    const bed = S.stations[STATIONS.findIndex((s) => s.id === 'lit')];
    this.duvetT += ((bed.made ? 0 : 1) - this.duvetT) * (1 - Math.exp(-dt * 6));
    const bd = STATIONS.find((s) => s.id === 'lit')!;
    this.duvet.position.set(bd.x + 0.25 + this.duvetT * 0.35, 0.56 + this.duvetT * 0.04, bd.z + this.duvetT * 0.45);
    this.duvet.rotation.set(this.duvetT * 0.18, Math.PI / 2 + this.duvetT * 0.5, this.duvetT * -0.12);
    // Flowerbeds.
    ['massif_est', 'massif_sud'].forEach((id, i) => {
      const st = S.stations[STATIONS.findIndex((s) => s.id === id)];
      this.wet[i].visible = st.watered && !st.dug;
    });

    this.syncMesses(S);
    // Treats.
    this.treats.forEach((m, i) => {
      const t = S.treats[i];
      m.visible = !!t;
      if (t) {
        m.position.set(t.x, t.y, t.z);
        m.rotation.y = t.id * 1.7 + (t.landed ? 0 : this.time * 8);
      }
    });
  }

  private syncItem(S: GameState, it: Item, tofuId: number, alpha: number, prev?: PrevSnapshot) {
    const m = this.items[it.idx];
    const t = ITEM_TYPES[it.type];
    m.visible = true;
    m.rotation.set(0, 0, 0);
    m.scale.setScalar(1);
    if (it.type === 'dishes') this.setTable.visible = false;
    switch (it.state) {
      case 'gone':
        m.visible = false;
        return;
      case 'held': {
        const h = S.chars[it.holder];
        if (!h) {
          m.visible = false;
          return;
        }
        if (h.id === tofuId) {
          this.dog.mouthWorld(this.tmpV);
          m.position.copy(this.tmpV);
          m.position.y -= t.category === 'laundry' ? 0.12 : 0.06;
          m.rotation.y = this.dog.root.rotation.y + (it.type === 'baguette' || it.type === 'ball' ? 0 : Math.PI / 2);
          if (it.type === 'baguette') m.rotation.y = this.dog.root.rotation.y + Math.PI / 2;
          m.scale.setScalar(t.category === 'laundry' ? 0.85 : 0.8);
        } else {
          const hm = this.humans.get(h.id);
          if (!hm) return;
          hm.carryWorld(this.tmpV);
          const k = h.hold.indexOf(it.idx);
          m.position.copy(this.tmpV);
          m.position.y += k * 0.11 - 0.12;
          m.rotation.y = hm.root.rotation.y;
        }
        return;
      }
      case 'stored': {
        const st = STATIONS[it.station];
        if (HIDDEN_KINDS.has(st.kind)) {
          m.visible = false;
          return;
        }
        if (it.type === 'dishes' && st.kind === 'dining_table') {
          m.visible = false;
          this.setTable.visible = true;
          this.setTable.position.set(st.x, st.y + 0.01, st.z);
          return;
        }
        m.position.set(it.x, it.y, it.z);
        if (st.kind === 'clothesline') {
          m.position.y = 1.83 - 0.36 * (t.size > 0.2 ? 1.1 : 0.8);
          m.rotation.y = 0;
          if (it.type === 'sock' || it.type === 'sock2') m.position.y = 1.62;
          if (it.type === 'underwear') m.position.y = 1.66;
          if (it.type === 'tshirt' || it.type === 'towel') m.position.y = 1.5;
          m.rotation.z = Math.sin(this.time * 1.7 + it.idx) * 0.08;
        } else if (st.kind === 'dog_basket' || st.kind === 'bedside') {
          this.lieFlat(m, it, t.category);
        }
        return;
      }
      case 'air': {
        const pi = it.idx * 3;
        const x = prev && prev.items.length > pi ? prev.items[pi] + (it.x - prev.items[pi]) * alpha : it.x;
        const y = prev && prev.items.length > pi ? prev.items[pi + 1] + (it.y - prev.items[pi + 1]) * alpha : it.y;
        const z = prev && prev.items.length > pi ? prev.items[pi + 2] + (it.z - prev.items[pi + 2]) * alpha : it.z;
        m.position.set(x, y, z);
        m.rotation.set(it.rot * 0.7, it.rot, it.rot * 0.4);
        return;
      }
      case 'knocked': {
        if (t.knock?.lie === 'scatter') {
          m.visible = false;
          return;
        }
        m.position.set(it.x, 0, it.z);
        m.rotation.set(0, it.rot, 0);
        if (t.knock?.lie === 'side') {
          m.rotation.set(0, it.rot, Math.PI / 2);
          m.position.y = t.size * 0.9;
        }
        return;
      }
      case 'free':
        m.position.set(it.x, 0, it.z);
        this.lieFlat(m, it, t.category);
        return;
      case 'home':
      default:
        m.position.set(it.x, it.y, it.z);
        m.rotation.y = it.rot;
    }
  }

  private lieFlat(m: THREE.Mesh, it: Item, category: string) {
    m.rotation.y = it.rot;
    if (category === 'laundry' && it.type !== 'slipper') {
      m.rotation.set(-Math.PI / 2, 0, it.rot);
      m.position.y = Math.max(m.position.y, 0) + 0.03;
    } else if (it.type === 'letter' || it.type === 'baguette') {
      m.position.y += 0.0;
    }
  }

  private syncMesses(S: GameState) {
    const mats = materials();
    const alive = new Set<number>();
    let printCount = 0;
    let key = '';
    for (const m of S.messes) {
      alive.add(m.id);
      if (m.kind === 'mud') {
        printCount += m.prints.length / 3;
        key += m.id + ':' + m.prints.length + ',';
        continue;
      }
      if (this.messes.has(m.id)) continue;
      const g = new THREE.Group();
      g.position.set(m.x, 0, m.z);
      if (m.kind === 'water') {
        const w = new THREE.Mesh(waterGeometry(m.r * 0.85, m.seed), mats.water);
        w.position.y = 0.022;
        w.renderOrder = 1;
        g.add(w);
      }
      if (m.kind === 'muddy_bed') g.position.y = 0.67;
      if (m.kind === 'muddy_sofa') g.position.y = 0.52;
      const geo = buildMessGeometry(m.kind, m.seed, m.r);
      if (geo) {
        const mm = new THREE.Mesh(geo, mats.vc);
        mm.position.y = 0.012;
        mm.receiveShadow = true;
        g.add(mm);
      }
      this.root.add(g);
      this.messes.set(m.id, { obj: g, rev: m.rev });
    }
    for (const [id, v] of this.messes) {
      if (!alive.has(id)) {
        this.root.remove(v.obj);
        v.obj.traverse((o) => {
          const mesh = o as THREE.Mesh;
          if (mesh.geometry && mesh.material !== mats.water) mesh.geometry.dispose();
        });
        this.messes.delete(id);
      }
    }
    if (key !== this.printsKey) {
      this.printsKey = key;
      let n = 0;
      for (const m of S.messes) {
        if (m.kind !== 'mud') continue;
        for (let i = 0; i < m.prints.length && n < MAX_PRINTS; i += 3) {
          const rot = m.prints[i + 2];
          this.tmpQ.setFromAxisAngle(this.tmpV.set(0, 1, 0), rot + Math.PI);
          this.tmpM.compose(this.tmpV.set(m.prints[i], 0.03 + (n % 7) * 0.0004, m.prints[i + 1]), this.tmpQ, new THREE.Vector3(1, 1, 1));
          this.prints.setMatrixAt(n++, this.tmpM);
        }
      }
      this.prints.count = n;
      this.prints.instanceMatrix.needsUpdate = true;
      void printCount;
    }
  }

  /** Floor ring showing what the local player would interact with. */
  setHighlight(slot: number, pos: { x: number; y: number; z: number } | null, color: number) {
    let m = this.highlight[slot];
    if (!m) {
      const g = new THREE.RingGeometry(0.32, 0.42, 28);
      g.rotateX(-Math.PI / 2);
      m = new THREE.Mesh(g, new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.85, depthWrite: false, depthTest: false }));
      m.renderOrder = 5;
      this.highlight[slot] = m;
      this.root.add(m);
    }
    if (!pos) {
      m.visible = false;
      return;
    }
    m.visible = true;
    m.position.set(pos.x, Math.max(0.04, pos.y + 0.02), pos.z);
    const s = 1 + Math.sin(this.time * 6) * 0.08;
    m.scale.setScalar(s);
  }

  /** World position of a character's head (for HUD bubbles). */
  headPos(S: GameState, id: number, out: THREE.Vector3): THREE.Vector3 {
    const c = S.chars[id];
    if (c.role === 'tofu') return out.set(this.dog.root.position.x, 1.15, this.dog.root.position.z);
    const h = this.humans.get(id);
    const s = h ? h.look.scale : 1;
    return out.set(h ? h.root.position.x : c.x, 2.05 * s, h ? h.root.position.z : c.z);
  }
}

function shadeHex(hex: number, k: number): THREE.Color {
  const c = new THREE.Color(hex);
  c.r *= k;
  c.g *= k;
  c.b *= k;
  return c;
}
