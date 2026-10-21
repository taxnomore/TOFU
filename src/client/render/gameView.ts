// Synchronizes dynamic 3D objects (characters, items, doors, messes, treats,
// cat, mail carrier, station states) with the simulation state.
import * as THREE from 'three';
import type { GameState, Item } from '../../shared/sim/types';
import { Anim } from '../../shared/sim/types';
import { ITEM_TYPES } from '../../shared/world/itemTypes';
import type { GameMap } from '../../shared/world/mapTypes';
import type { DoorDef } from '../../shared/world/types';
import { CatModel, DogModel, HumanModel, PASSER_LOOK } from './characters';
import { GeoBuilder } from './geo';
import { buildItemGeometry, buildMessGeometry, buildSetTableGeometry, treatGeometry, waterGeometry } from './itemModels';
import { materials } from './materials';
import { StationViews } from './stationViews';
import { dotTexture, leafTexture, pawTexture, paperTexture } from './textures';

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

const HIDDEN_KINDS = new Set(['hamper', 'dresser', 'toybox', 'mailbox', 'cupboard', 'street_bin', 'cabinet']);
/** Stations where clothes hang (coat hooks, shop rails). */
const HANGING_KINDS = new Set(['coat_hooks', 'clothes_rack']);
const MAX_PRINTS = 900;
const MAX_PAPER = 400;
const MAX_DROPS = 500;
const MAX_LEAVES = 400;
const LEAF_COLORS = [0xd35400, 0xe67e22, 0xeba524, 0xc0392b, 0xd4a017, 0xb5651d].map((c) => new THREE.Color(c));

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
  carrier: HumanModel;
  private vacuum = new THREE.Group();
  private vacuumLed!: THREE.Mesh;
  private items: THREE.Mesh[] = [];
  private setTable: THREE.Mesh;
  private doors: DoorVis[] = [];
  private messes = new Map<number, { obj: THREE.Object3D; rev: number }>();
  private prints: THREE.InstancedMesh;
  private printsKey = '';
  private paper: THREE.InstancedMesh;
  private paperKey = '';
  /** Water drops and wet paw marks; leaves shed indoors. */
  private drops: THREE.InstancedMesh;
  private dropsKey = '';
  private leaves: THREE.InstancedMesh;
  private leavesKey = '';
  private treats: THREE.Mesh[] = [];
  private stationViews: StationViews;
  /** Facing of the toilet roll on its holder, per station. */
  private rollRot = new Map<number, number>();
  private tmpV = new THREE.Vector3();
  private tmpM = new THREE.Matrix4();
  private tmpQ = new THREE.Quaternion();
  private highlight: THREE.Mesh[] = [];
  time = 0;

  constructor(scene: THREE.Scene, S: GameState, readonly map: GameMap) {
    scene.add(this.root);
    this.carrier = new HumanModel(PASSER_LOOK[map.carrier.look]);
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

    // Robot vacuum.
    const vb = new GeoBuilder();
    vb.cylU(0.2, 0.07, { y: 0.045 }, 0x3d4852, 20);
    vb.cylU(0.175, 0.014, { y: 0.086 }, 0x5d6d7e, 20);
    vb.cylU(0.05, 0.012, { y: 0.096, z: -0.05 }, 0x2c3e50, 12);
    vb.box(0.26, 0.04, 0.05, { y: 0.035, z: 0.175 }, 0x17202a);
    this.vacuum.add(vb.mesh(materials().vc));
    this.vacuumLed = new THREE.Mesh(new THREE.SphereGeometry(0.02, 8, 6), new THREE.MeshBasicMaterial({ color: 0xf39c12 }));
    this.vacuumLed.position.set(0, 0.1, 0.1);
    this.vacuum.add(this.vacuumLed);
    this.root.add(this.vacuum);

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
    map.doors.forEach((d) => this.doors.push(this.buildDoor(d)));

    // Paw prints.
    const pg = new THREE.PlaneGeometry(0.17, 0.17);
    pg.rotateX(-Math.PI / 2);
    const pm = new THREE.MeshBasicMaterial({ color: 0x5b3a22, map: pawTexture(), transparent: true, depthWrite: false, opacity: 0.88, polygonOffset: true, polygonOffsetFactor: -2 });
    this.prints = new THREE.InstancedMesh(pg, pm, MAX_PRINTS);
    this.prints.count = 0;
    this.prints.frustumCulled = false;
    this.prints.renderOrder = 1;
    this.root.add(this.prints);

    // Toilet paper strips.
    const sg = new THREE.PlaneGeometry(0.15, 0.38);
    sg.rotateX(-Math.PI / 2);
    const sm = new THREE.MeshLambertMaterial({ color: 0xffffff, map: paperTexture(), side: THREE.DoubleSide, polygonOffset: true, polygonOffsetFactor: -2 });
    this.paper = new THREE.InstancedMesh(sg, sm, MAX_PAPER);
    this.paper.count = 0;
    this.paper.frustumCulled = false;
    this.paper.renderOrder = 1;
    this.root.add(this.paper);

    // Water drops (leaking can, wet paws).
    const dg = new THREE.PlaneGeometry(0.24, 0.24);
    dg.rotateX(-Math.PI / 2);
    const dm = new THREE.MeshPhongMaterial({ color: 0x3d8fd1, map: dotTexture(), transparent: true, opacity: 0.7, shininess: 100, specular: 0xffffff, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2 });
    this.drops = new THREE.InstancedMesh(dg, dm, MAX_DROPS);
    this.drops.count = 0;
    this.drops.frustumCulled = false;
    this.drops.renderOrder = 1;
    this.root.add(this.drops);
    // Leaves Tofu brings inside.
    const lg = new THREE.PlaneGeometry(0.13, 0.08);
    lg.rotateX(-Math.PI / 2);
    const lm = new THREE.MeshLambertMaterial({ map: leafTexture(), transparent: true, alphaTest: 0.3, side: THREE.DoubleSide, polygonOffset: true, polygonOffsetFactor: -2 });
    this.leaves = new THREE.InstancedMesh(lg, lm, MAX_LEAVES);
    this.leaves.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(MAX_LEAVES * 3), 3);
    this.leaves.count = 0;
    this.leaves.frustumCulled = false;
    this.leaves.renderOrder = 1;
    this.root.add(this.leaves);

    // Treats pool.
    const tg = treatGeometry();
    for (let i = 0; i < 9; i++) {
      const m = new THREE.Mesh(tg, mats.vc);
      m.visible = false;
      this.treats.push(m);
      this.root.add(m);
    }

    // Make stations (bed, blanket, ribbon...), clothesline, jars, watered beds.
    this.stationViews = new StationViews(map);
    this.root.add(this.stationViews.root);
    map.stations.forEach((st, si) => {
      if (st.kind !== 'roll_holder') return;
      let best = 0;
      let bd = Infinity;
      for (const p of map.props) {
        if (p.type !== 'roll_holder') continue;
        const d = Math.hypot(p.x - st.x, p.z - st.z);
        if (d < bd) {
          bd = d;
          best = ((p.rot ?? 0) * Math.PI) / 2;
        }
      }
      this.rollRot.set(si, best);
    });

    // Interaction highlight rings (one per local player, created on demand).
  }

  private buildDoor(d: DoorDef): DoorVis {
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

    // Robot vacuum: a little wobble when running, blinking green light, orange on its dock.
    const vac = S.vacuum;
    if (vac) {
      const on = vac.mode !== 'dock';
      this.vacuum.position.set(vac.x, on ? Math.abs(Math.sin(this.time * 23)) * 0.006 : 0, vac.z);
      this.vacuum.rotation.y = vac.facing;
      (this.vacuumLed.material as THREE.MeshBasicMaterial).color.setHex(on ? (Math.sin(this.time * 9) > 0 ? 0x2ecc71 : 0x145a32) : 0xf39c12);
    }

    // Items.
    const tofu = S.chars.find((c) => c.role === 'tofu')!;
    for (const it of S.items) this.syncItem(S, it, tofu.id, alpha, prev);

    // Doors.
    S.doors.forEach((ds, i) => {
      const v = this.doors[i];
      const target = ds.open ? 1 : 0;
      v.angle += (target - v.angle) * (1 - Math.exp(-dt * 9));
      const D = this.map.doors[i];
      if (v.slide) {
        const w = D.width / 2;
        const along = D.axis === 'x';
        v.slide.forEach((g, k) => {
          const base = k === 0 ? -w / 2 : w / 2;
          const off = (k === 0 ? -1 : 1) * v.angle * (w - 0.1);
          if (along) g.position.x = D.x + base + off;
          else g.position.z = D.z + base + off;
        });
      }
      v.pivots.forEach((p, k) => {
        p.rotation.y = v.sign[k] * v.angle * (Math.PI / 2) * 0.97;
      });
      if (v.flap) {
        const dd = Math.hypot(tofu.x - D.x, tofu.z - D.z);
        const swing = dd < 0.7 ? Math.sin(this.time * 18) * 0.6 * (1 - dd / 0.7) : 0;
        v.flap.rotation.x += (swing - v.flap.rotation.x) * 0.3;
      }
    });

    // Beds, blankets, ribbons, watered flowerbeds.
    this.stationViews.update(S, dt);

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
        const st = this.map.stations[it.station];
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
        } else if (st.kind === 'roll_holder') {
          // The roll hangs on its bar along the wall.
          m.rotation.y = this.rollRot.get(it.station) ?? 0;
        } else if (st.kind === 'notice_board') {
          // The poster is pinned upright on the board.
          m.rotation.set(Math.PI / 2, 0, 0);
        } else if (HANGING_KINDS.has(st.kind)) {
          // Clothes hang from their hook or rail (slot height is the hook).
          m.rotation.y = st.kind === 'clothes_rack' ? Math.PI / 2 * ((st.hw ?? 1) >= (st.hd ?? 0) ? 0 : 1) : 0;
          m.position.y = it.y - 0.32 * (t.size > 0.2 ? 1.1 : 0.7);
          m.rotation.z = Math.sin(this.time * 1.2 + it.idx) * 0.04;
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
    let paperKey = '';
    let dropsKey = '';
    let leavesKey = '';
    for (const m of S.messes) {
      alive.add(m.id);
      if (m.kind === 'mud') {
        printCount += m.prints.length / 3;
        key += m.id + ':' + m.prints.length + ',';
        continue;
      }
      if (m.kind === 'paper') {
        paperKey += m.id + ':' + m.prints.length + ',';
        continue;
      }
      if (m.kind === 'wet') {
        dropsKey += m.id + ':' + m.prints.length + ':' + m.prints[0] + ',';
        continue;
      }
      if (m.kind === 'leaf_trail') {
        leavesKey += m.id + ':' + m.prints.length + ',';
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
      if (m.station >= 0 && this.map.stations[m.station]?.kind === 'bed') g.position.y = StationViews.messY(this.map.stations[m.station]);
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
    if (paperKey !== this.paperKey) {
      this.paperKey = paperKey;
      let n = 0;
      const up = new THREE.Vector3(0, 1, 0);
      const scale = new THREE.Vector3();
      for (const m of S.messes) {
        if (m.kind !== 'paper') continue;
        for (let i = 0; i < m.prints.length && n < MAX_PAPER; i += 3) {
          this.tmpQ.setFromAxisAngle(up, m.prints[i + 2]);
          // Slight size variety so the trail looks crumpled.
          const k = 0.85 + ((n * 37) % 11) / 30;
          scale.set(k, 1, 0.8 + ((n * 53) % 7) / 15);
          this.tmpM.compose(this.tmpV.set(m.prints[i], 0.025 + (n % 5) * 0.0005, m.prints[i + 1]), this.tmpQ, scale);
          this.paper.setMatrixAt(n++, this.tmpM);
        }
      }
      this.paper.count = n;
      this.paper.instanceMatrix.needsUpdate = true;
    }
    if (dropsKey !== this.dropsKey) {
      this.dropsKey = dropsKey;
      let n = 0;
      const up = new THREE.Vector3(0, 1, 0);
      const scale = new THREE.Vector3();
      for (const m of S.messes) {
        if (m.kind !== 'wet') continue;
        for (let i = 0; i < m.prints.length && n < MAX_DROPS; i += 3) {
          this.tmpQ.setFromAxisAngle(up, m.prints[i + 2]);
          const k = 0.75 + ((n * 41) % 9) / 14;
          scale.set(k, 1, k * (0.8 + ((n * 17) % 5) / 12));
          this.tmpM.compose(this.tmpV.set(m.prints[i], 0.028 + (n % 5) * 0.0004, m.prints[i + 1]), this.tmpQ, scale);
          this.drops.setMatrixAt(n++, this.tmpM);
        }
      }
      this.drops.count = n;
      this.drops.instanceMatrix.needsUpdate = true;
    }
    if (leavesKey !== this.leavesKey) {
      this.leavesKey = leavesKey;
      let n = 0;
      const up = new THREE.Vector3(0, 1, 0);
      const one = new THREE.Vector3(1, 1, 1);
      for (const m of S.messes) {
        if (m.kind !== 'leaf_trail') continue;
        for (let i = 0; i < m.prints.length && n < MAX_LEAVES; i += 3) {
          this.tmpQ.setFromAxisAngle(up, m.prints[i + 2]);
          this.tmpM.compose(this.tmpV.set(m.prints[i], 0.026 + (n % 5) * 0.0005, m.prints[i + 1]), this.tmpQ, one);
          this.leaves.setMatrixAt(n, this.tmpM);
          this.leaves.setColorAt(n, LEAF_COLORS[(n * 7) % LEAF_COLORS.length]);
          n++;
        }
      }
      this.leaves.count = n;
      this.leaves.instanceMatrix.needsUpdate = true;
      if (this.leaves.instanceColor) this.leaves.instanceColor.needsUpdate = true;
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
