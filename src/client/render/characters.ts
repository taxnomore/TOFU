// Procedurally built and animated characters: Tofu (yellow Labrador), the
// humans (4 looks) and the neighbors' cat. No skeletal rigs: hierarchies of
// simple shapes with damped procedural poses (cheap and expressive).
import * as THREE from 'three';
import { Anim } from '../../shared/sim/types';
import type { CatState, Character } from '../../shared/sim/types';
import { angleDiff, clamp } from '../../shared/math';
import { GeoBuilder } from './geo';
import { materials } from './materials';

const tmpV = new THREE.Vector3();

function mesh(b: GeoBuilder, mat?: THREE.Material): THREE.Mesh {
  const m = new THREE.Mesh(b.build(), mat ?? materials().vc);
  m.castShadow = true;
  m.receiveShadow = false;
  return m;
}

function joint(parent: THREE.Object3D, x: number, y: number, z: number): THREE.Group {
  const g = new THREE.Group();
  g.position.set(x, y, z);
  parent.add(g);
  return g;
}

/** Damped approach of a rotation component. */
function dampRot(o: THREE.Object3D, rx: number, ry: number, rz: number, k: number) {
  o.rotation.x += (rx - o.rotation.x) * k;
  o.rotation.y += (ry - o.rotation.y) * k;
  o.rotation.z += (rz - o.rotation.z) * k;
}

function blobShadow(size: number): THREE.Mesh {
  const g = new THREE.CircleGeometry(size, 20);
  g.rotateX(-Math.PI / 2);
  const m = new THREE.Mesh(g, new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.22, depthWrite: false }));
  m.position.y = 0.015;
  m.renderOrder = 1;
  return m;
}

// ============================================================================
// Tofu
// ============================================================================

const GOLD = 0xe9bb63;
const GOLD_LIGHT = 0xf6d99b;
const GOLD_DARK = 0xcf9a45;
const NOSE = 0x3a2a22;

export class DogModel {
  readonly root = new THREE.Group();
  private body: THREE.Group;
  private head: THREE.Group;
  private jaw: THREE.Group;
  private tongue: THREE.Mesh;
  private ears: THREE.Group[] = [];
  private brows: THREE.Mesh[] = [];
  private eyes: THREE.Mesh[] = [];
  private tail: THREE.Group[] = [];
  private legs: THREE.Group[] = [];
  private pawMat: THREE.MeshLambertMaterial;
  private mudSpots: THREE.Mesh;
  /** Leaves stuck in the fur (autumn piles). */
  private leafBits: THREE.Mesh;
  private halo: THREE.Mesh;
  private stars: THREE.Group;
  readonly mouth: THREE.Group;
  private phase = 0;
  private time = 0;
  private yaw = 0;
  private blinkT = 2;
  private haloT = 0;

  /** Visual scale: a bit larger than life so Tofu reads well from the camera. */
  private scaled: THREE.Group;

  constructor() {
    this.root.add(blobShadow(0.5));
    this.scaled = joint(this.root, 0, 0, 0);
    this.scaled.scale.setScalar(1.22);
    this.body = joint(this.scaled, 0, 0.47, 0);
    // Torso, chest, rump, haunches.
    const b = new GeoBuilder();
    b.sphere(0.5, { sx: 0.4, sy: 0.37, sz: 0.8 }, GOLD, 'hi');
    b.sphere(0.21, { y: 0.02, z: 0.23 }, GOLD);
    b.sphere(0.17, { y: -0.06, z: 0.25, sx: 0.9 }, GOLD_LIGHT);
    b.sphere(0.2, { y: 0.01, z: -0.25 }, GOLD);
    for (const s of [-1, 1]) b.sphere(0.12, { x: s * 0.12, y: -0.03, z: -0.24, sz: 1.3 }, GOLD);
    b.sphere(0.13, { y: 0.09, z: 0.33, sz: 1.2, sy: 1.1 }, GOLD); // neck
    this.body.add(mesh(b));
    // Collar + tag.
    const col = new GeoBuilder();
    col.torus(0.115, 0.026, { y: 0.13, z: 0.35, rx: Math.PI / 2 - 0.65 }, 0xd63031);
    col.cylU(0.03, 0.008, { y: 0.02, z: 0.45, rx: Math.PI / 2 - 0.3 }, 0xf1c40f, 12);
    this.body.add(mesh(col));
    // Mud spots on the body (shown when muddy).
    const ms = new GeoBuilder();
    for (const [x, y, z, r] of [[0.16, -0.05, 0.1, 0.06], [-0.17, 0.0, -0.12, 0.07], [0.12, -0.1, -0.25, 0.05], [-0.08, -0.13, 0.2, 0.05], [0.0, 0.15, -0.05, 0.05]]) {
      ms.sphere(r, { x, y, z, sy: 0.6 }, 0x6b4a32);
    }
    this.mudSpots = mesh(ms);
    this.mudSpots.visible = false;
    this.body.add(this.mudSpots);
    const lb = new GeoBuilder();
    const leafCols = [0xd35400, 0xe67e22, 0xeba524, 0xc0392b];
    [[0.15, 0.08, 0.05], [-0.16, 0.1, -0.1], [0.05, 0.17, -0.22], [-0.06, 0.16, 0.18], [0.17, -0.02, -0.2], [-0.15, -0.04, 0.12]].forEach(([x, y, z], i) => {
      lb.box(0.09, 0.012, 0.055, { x, y, z, ry: i * 1.3, rz: (i % 3) * 0.4 - 0.4 }, leafCols[i % leafCols.length]);
    });
    this.leafBits = mesh(lb);
    this.leafBits.visible = false;
    this.body.add(this.leafBits);

    // Head.
    this.head = joint(this.body, 0, 0.19, 0.4);
    const h = new GeoBuilder();
    h.sphere(0.165, { y: 0.06, z: 0.03, sz: 1.08, sx: 1.04 }, GOLD, 'hi');
    h.rbox(0.16, 0.11, 0.2, 0.05, { y: 0.0, z: 0.17 }, GOLD_LIGHT);
    h.sphere(0.042, { y: 0.04, z: 0.275, sx: 1.2 }, NOSE);
    h.sphere(0.012, { x: 0.012, y: 0.055, z: 0.3 }, 0x8a7a70);
    // Cheeks.
    for (const s of [-1, 1]) h.sphere(0.055, { x: s * 0.06, y: -0.02, z: 0.15 }, GOLD_LIGHT);
    this.head.add(mesh(h));
    // Eyes and brows (separate for blinking/expressions).
    for (const s of [-1, 1]) {
      const e = new GeoBuilder();
      e.sphere(0.03, {}, 0x1e1712);
      e.sphere(0.011, { x: -s * 0.006, y: 0.012, z: 0.022 }, 0xffffff, 'lo');
      const em = mesh(e);
      em.position.set(s * 0.068, 0.095, 0.15);
      this.head.add(em);
      this.eyes.push(em);
      const br = new GeoBuilder();
      br.rbox(0.06, 0.016, 0.02, 0.008, {}, GOLD_DARK);
      const bm = mesh(br);
      bm.position.set(s * 0.07, 0.14, 0.15);
      this.head.add(bm);
      this.brows.push(bm);
    }
    // Jaw + tongue.
    this.jaw = joint(this.head, 0, -0.045, 0.1);
    const j = new GeoBuilder();
    j.rbox(0.13, 0.04, 0.15, 0.018, { y: -0.012, z: 0.07 }, GOLD_LIGHT);
    j.box(0.1, 0.012, 0.12, { y: 0.008, z: 0.07 }, 0x5a2a2a);
    this.jaw.add(mesh(j));
    const tg = new GeoBuilder();
    tg.rbox(0.07, 0.016, 0.13, 0.008, { y: 0.0, z: 0.08 }, 0xff7b8a);
    this.tongue = mesh(tg);
    this.tongue.position.set(0, 0.0, 0.04);
    this.jaw.add(this.tongue);
    // Ears.
    for (const s of [-1, 1]) {
      const ej = joint(this.head, s * 0.13, 0.15, 0.0);
      const e = new GeoBuilder();
      e.sphere(0.5, { y: -0.09, sx: 0.06, sy: 0.2, sz: 0.13 }, GOLD_DARK);
      ej.add(mesh(e));
      ej.rotation.z = s * 0.35;
      this.ears.push(ej);
    }
    this.mouth = joint(this.head, 0, -0.03, 0.27);
    // Halo (innocent) and stun stars.
    const halo = new GeoBuilder();
    halo.torus(0.12, 0.018, { rx: Math.PI / 2 }, 0xffe066);
    this.halo = new THREE.Mesh(halo.build(), new THREE.MeshBasicMaterial({ color: 0xffe066 }));
    this.halo.position.set(0, 0.36, 0.0);
    this.halo.visible = false;
    this.head.add(this.halo);
    this.stars = joint(this.head, 0, 0.33, 0);
    for (let i = 0; i < 3; i++) {
      const st = new GeoBuilder();
      st.extrude(starPts(0.05, 0.022), 0.02, {}, 0xffd32a);
      const sm = new THREE.Mesh(st.build(), new THREE.MeshBasicMaterial({ color: 0xffd32a }));
      const a = (i / 3) * Math.PI * 2;
      sm.position.set(Math.cos(a) * 0.17, 0, Math.sin(a) * 0.17);
      this.stars.add(sm);
    }
    this.stars.visible = false;

    // Legs: upper part in body colour, lower part + paw with the (muddy) paw material.
    this.pawMat = new THREE.MeshLambertMaterial({ vertexColors: true });
    const legPos: [number, number, number][] = [[0.115, -0.06, 0.22], [-0.115, -0.06, 0.22], [0.115, -0.04, -0.25], [-0.115, -0.04, -0.25]];
    legPos.forEach(([x, y, z], i) => {
      const lj = joint(this.body, x, y, z);
      const up = new GeoBuilder();
      const back = i >= 2;
      up.cylU(back ? 0.062 : 0.055, 0.22, { y: -0.1 }, GOLD);
      lj.add(mesh(up));
      const lo = new GeoBuilder();
      lo.cylU(0.05, 0.2, { y: -0.26 }, GOLD);
      lo.sphere(0.068, { y: -0.37, z: 0.025, sy: 0.55, sz: 1.35 }, GOLD_LIGHT);
      lj.add(mesh(lo, this.pawMat));
      this.legs.push(lj);
    });
    // Tail (3 segments, otter-like taper).
    let parent: THREE.Object3D = this.body;
    const seg = [[0.05, 0.16], [0.042, 0.15], [0.032, 0.14]];
    let z = -0.38;
    let y = 0.06;
    seg.forEach(([r, len], i) => {
      const tj = joint(parent, 0, y, z);
      const tb = new GeoBuilder();
      tb.cylU(r, len, { z: -len / 2, rx: Math.PI / 2 }, i === 2 ? GOLD_LIGHT : GOLD);
      tb.sphere(r, { z: -len }, i === 2 ? GOLD_LIGHT : GOLD);
      tj.add(mesh(tb));
      this.tail.push(tj);
      parent = tj;
      z = -len;
      y = 0;
    });
    this.tail[0].rotation.x = -0.7;
  }

  /** Visual update from the simulation state. */
  update(c: Character, dt: number, mudSurface: boolean) {
    this.time += dt;
    const t = this.time;
    const k = 1 - Math.exp(-dt * 14);
    const kSlow = 1 - Math.exp(-dt * 6);
    this.root.position.set(c.x, 0, c.z);
    this.yaw += angleDiff(this.yaw, c.facing) * (1 - Math.exp(-dt * 16));
    this.root.rotation.y = this.yaw;

    const anim = c.anim;
    const speed = c.speed;
    const zoom = c.zoomT > 0;
    const running = anim === Anim.Run || zoom;
    this.phase += dt * (running ? 13 + speed * 1.2 : 4 + speed * 2.6);
    const ph = this.phase;

    // Defaults.
    let bodyY = 0.47;
    let bodyPitch = 0;
    let bodyRoll = 0;
    let headPitch = 0;
    let headYaw = Math.sin(t * 0.7) * 0.15;
    let headRoll = 0;
    let jawOpen = 0.05;
    let tongueOut = c.pantT > 0 || zoom || c.stamina < 0.3;
    const legs = [0, 0, 0, 0];
    let tailBase = -0.55;
    let wagSpeed = 9;
    let wagAmp = 0.45;
    let earBack = 0;
    let earFlop = Math.sin(t * 2) * 0.05;
    let browTilt = 0;
    let stretch = 1;
    let hop = 0;

    if (anim === Anim.Walk || anim === Anim.Run || (zoom && speed > 0.3)) {
      if (running) {
        // Gallop: front pair and back pair.
        const a = 0.95;
        legs[0] = Math.sin(ph) * a;
        legs[1] = Math.sin(ph + 0.5) * a;
        legs[2] = Math.sin(ph + Math.PI) * a;
        legs[3] = Math.sin(ph + Math.PI + 0.5) * a;
        bodyPitch = Math.sin(ph) * 0.12;
        bodyY += Math.abs(Math.cos(ph)) * 0.06;
        earBack = 0.9;
        headPitch = -0.15;
        wagSpeed = zoom ? 30 : 12;
        wagAmp = zoom ? 0.9 : 0.4;
        tailBase = zoom ? -1.1 : -0.35;
        stretch = zoom ? 1.12 : 1.05;
      } else {
        const a = 0.55;
        legs[0] = Math.sin(ph) * a;
        legs[3] = Math.sin(ph) * a;
        legs[1] = Math.sin(ph + Math.PI) * a;
        legs[2] = Math.sin(ph + Math.PI) * a;
        bodyY += Math.abs(Math.sin(ph)) * 0.025;
        bodyRoll = Math.sin(ph) * 0.04;
        earFlop = Math.sin(ph * 2) * 0.18;
        headPitch = Math.sin(ph * 2) * 0.04;
        wagSpeed = 10;
      }
      headYaw *= 0.3;
    }
    if (anim === Anim.Sit) {
      bodyPitch = -0.55;
      bodyY = 0.34;
      legs[0] = 0.5;
      legs[1] = 0.5;
      legs[2] = -1.45;
      legs[3] = -1.45;
      headPitch = 0.35;
      tailBase = 0.4;
      wagSpeed = 6;
      wagAmp = 0.25;
      if (c.sitT > 1.2) {
        // Innocent look: head tilt, brows up.
        headRoll = Math.sin(t * 1.3) * 0.25 + 0.15;
        browTilt = 0.35;
      }
    }
    if (anim === Anim.Bark) {
      const p = clamp(c.animT / 0.35, 0, 1);
      headPitch = 0.35 * Math.sin(p * Math.PI);
      jawOpen = 0.55 * Math.sin(p * Math.PI);
      bodyPitch = -0.1;
      earBack = 0.4;
    }
    if (anim === Anim.Eat) {
      headPitch = -0.6;
      jawOpen = 0.15 + Math.abs(Math.sin(t * 14)) * 0.3;
      bodyPitch = 0.12;
      wagSpeed = 14;
      wagAmp = 0.7;
    }
    if (anim === Anim.Push || anim === Anim.Interact) {
      headPitch = -0.35;
      bodyPitch = 0.12;
      legs[2] = -0.3;
      legs[3] = -0.3;
      legs[0] = 0.25;
      legs[1] = 0.25;
      if (anim === Anim.Push) bodyY += Math.sin(t * 18) * 0.012;
    }
    if (anim === Anim.Dig) {
      headPitch = -0.5;
      bodyPitch = 0.3;
      legs[0] = Math.sin(t * 22) * 0.9 + 0.4;
      legs[1] = Math.sin(t * 22 + Math.PI) * 0.9 + 0.4;
      legs[2] = -0.5;
      legs[3] = -0.5;
      tailBase = -0.9;
      wagSpeed = 18;
    }
    if (anim === Anim.Jump) {
      const p = clamp(c.animT / 0.8, 0, 1);
      hop = Math.sin(p * Math.PI) * 0.45;
      legs[0] = -0.8;
      legs[1] = -0.8;
      legs[2] = 0.7;
      legs[3] = 0.7;
      bodyPitch = -0.3 * Math.cos(p * Math.PI);
      earBack = 0.7;
      wagSpeed = 16;
    }
    if (anim === Anim.Cheer) {
      hop = Math.abs(Math.sin(t * 7)) * 0.25;
      wagSpeed = 22;
      wagAmp = 0.9;
      jawOpen = 0.3;
      tongueOut = true;
      headPitch = 0.3;
    }
    if (c.stun > 0 || anim === Anim.Boop) {
      headYaw = Math.sin(t * 24) * 0.35;
      earBack = -0.3;
      tailBase = 0.3;
      wagAmp = 0.05;
    }
    if (c.lureKind) {
      wagSpeed = 20;
      wagAmp = 0.8;
      browTilt = 0.4;
      tongueOut = true;
    }
    if (c.hold.length) jawOpen = Math.max(jawOpen, 0.18);
    if (tongueOut) jawOpen = Math.max(jawOpen, 0.22);

    // Apply.
    this.body.position.y += (bodyY + hop - this.body.position.y) * k;
    dampRot(this.body, bodyPitch, 0, bodyRoll, k);
    this.body.scale.z += (stretch - this.body.scale.z) * kSlow;
    dampRot(this.head, -headPitch, headYaw, headRoll, k);
    this.jaw.rotation.x += (jawOpen - this.jaw.rotation.x) * k;
    this.tongue.visible = tongueOut;
    this.tongue.position.y = tongueOut ? -0.012 + Math.sin(t * 9) * 0.004 : 0;
    this.ears.forEach((e, i) => {
      const s = i === 0 ? -1 : 1;
      dampRot(e, -earBack, 0, s * (0.35 + earFlop * s), k);
    });
    this.legs.forEach((l, i) => dampRot(l, legs[i], 0, 0, running ? 0.6 : k));
    // Tail wag.
    const wag = Math.sin(t * wagSpeed) * wagAmp;
    dampRot(this.tail[0], tailBase, wag, 0, k);
    dampRot(this.tail[1], 0.25, wag * 0.6, zoom ? t * 40 : 0, k);
    dampRot(this.tail[2], 0.2, wag * 0.5, 0, k);
    if (zoom) this.tail[1].rotation.z = t * 40;
    // Eyes blink.
    this.blinkT -= dt;
    const closed = this.blinkT < 0.12 || (anim === Anim.Sit && c.sitT > 1.2 && Math.sin(t * 0.8) > 0.6);
    if (this.blinkT < 0) this.blinkT = 2 + Math.random() * 3;
    for (const e of this.eyes) e.scale.y += ((closed ? 0.15 : 1) - e.scale.y) * 0.5;
    this.brows.forEach((b, i) => {
      const s = i === 0 ? -1 : 1;
      b.rotation.z = s * browTilt;
      b.position.y = 0.14 + browTilt * 0.03;
    });
    // Mud.
    // Dirty paws: brown mud, white snow, or leaves in the fur.
    const mud = clamp(c.mud, 0, 1);
    const kind = c.pawKind ?? 'mud';
    if (kind === 'snow') this.pawMat.color.setRGB(1 + mud * 0.4, 1 + mud * 0.45, 1 + mud * 0.55);
    else if (kind === 'leaves') this.pawMat.color.setRGB(1, 1 - mud * 0.25, 1 - mud * 0.55);
    else this.pawMat.color.setRGB(1 - mud * 0.62, 1 - mud * 0.7, 1 - mud * 0.78);
    this.mudSpots.visible = kind === 'mud' && mud > 0.45;
    this.leafBits.visible = kind === 'leaves' && mud > 0.15;
    void mudSurface;
    // Halo + stars (halo when sitting still long enough: "who, me?").
    if (anim === Anim.Sit && c.sitT > 3.5) this.haloT = Math.min(1, this.haloT + dt * 2);
    else this.haloT = Math.max(0, this.haloT - dt * 3);
    this.halo.visible = this.haloT > 0.05;
    this.halo.scale.setScalar(this.haloT);
    this.halo.rotation.y = t * 1.5;
    this.halo.position.y = 0.34 + Math.sin(t * 3) * 0.02;
    this.stars.visible = c.stun > 0;
    this.stars.rotation.y = t * 6;
  }

  mouthWorld(out: THREE.Vector3): THREE.Vector3 {
    return this.mouth.getWorldPosition(out);
  }
}

function starPts(r: number, r2: number): [number, number][] {
  const pts: [number, number][] = [];
  for (let i = 0; i < 10; i++) {
    const a = (i / 10) * Math.PI * 2 + Math.PI / 2;
    const rr = i % 2 ? r2 : r;
    pts.push([Math.cos(a) * rr, Math.sin(a) * rr]);
  }
  return pts;
}

// ============================================================================
// Humans
// ============================================================================

export interface HumanLook {
  name: string;
  skin: number;
  shirt: number;
  pants: number;
  shoes: number;
  hair: number;
  hairStyle: 'ponytail' | 'short' | 'pigtails' | 'curly' | 'cap';
  scale: number;
  beard?: boolean;
  skirt?: boolean;
}

export const HUMAN_LOOKS: HumanLook[] = [
  { name: 'Maman', skin: 0xf2c6a0, shirt: 0xff7a62, pants: 0x34506e, shoes: 0xf5f5f5, hair: 0x6b3e26, hairStyle: 'ponytail', scale: 1 },
  { name: 'Papa', skin: 0xe8b48d, shirt: 0x4a90d9, pants: 0xc9b38b, shoes: 0x6b4423, hair: 0x2f241d, hairStyle: 'short', scale: 1.04, beard: true },
  { name: 'Léa', skin: 0xf7d2b4, shirt: 0xffcf3f, pants: 0x9b59b6, shoes: 0xff6b9a, hair: 0xe0b65a, hairStyle: 'pigtails', scale: 0.8, skirt: true },
  { name: 'Hugo', skin: 0xd9a07a, shirt: 0x3fcf8e, pants: 0x2f6fb5, shoes: 0x2d3436, hair: 0xb5532b, hairStyle: 'curly', scale: 0.82 },
  { name: 'Factrice', skin: 0xeab896, shirt: 0x2d5fa8, pants: 0x2b3a55, shoes: 0x2d3436, hair: 0x3a2a20, hairStyle: 'cap', scale: 1 },
];

export class HumanModel {
  readonly root = new THREE.Group();
  private hips: THREE.Group;
  private torso: THREE.Group;
  private head: THREE.Group;
  private shoulders: THREE.Group[] = [];
  private elbows: THREE.Group[] = [];
  private thighs: THREE.Group[] = [];
  private knees: THREE.Group[] = [];
  private eyes: THREE.Mesh[] = [];
  private mouthMesh: THREE.Mesh;
  readonly carry: THREE.Group;
  private phase = 0;
  private time = 0;
  private yaw = 0;
  private blinkT = 3;
  private scaled: THREE.Group;
  readonly look: HumanLook;

  constructor(avatar: number) {
    const L = (this.look = HUMAN_LOOKS[avatar % HUMAN_LOOKS.length]);
    this.root.add(blobShadow(0.36));
    const scaled = (this.scaled = new THREE.Group());
    scaled.scale.setScalar(L.scale);
    this.root.add(scaled);
    this.hips = joint(scaled, 0, 0.9, 0);
    const pel = new GeoBuilder();
    pel.rbox(0.36, 0.2, 0.24, 0.08, { y: 0.02 }, L.pants);
    if (L.skirt) pel.cyl(0.2, 0.3, 0.3, { y: -0.08 }, L.pants, 12);
    this.hips.add(mesh(pel));
    this.torso = joint(this.hips, 0, 0.08, 0);
    const t = new GeoBuilder();
    t.rbox(0.42, 0.52, 0.25, 0.1, { y: 0.27 }, L.shirt);
    t.rbox(0.44, 0.07, 0.26, 0.03, { y: 0.05 }, shadeHex(L.shirt, 0.85));
    t.cylU(0.055, 0.1, { y: 0.56 }, L.skin, 10);
    if (L.hairStyle === 'cap') {
      // Mail carrier: yellow bag + stripes.
      t.rbox(0.3, 0.26, 0.1, 0.04, { x: 0.18, y: 0.12, z: 0.0, rz: 0.1, ry: Math.PI / 2 }, 0xf6c445);
      t.box(0.04, 0.6, 0.02, { x: 0.0, y: 0.3, z: 0.13, rz: 0.75 }, 0xf6c445);
      t.box(0.44, 0.04, 0.27, { y: 0.4 }, 0xf6c445);
    }
    this.torso.add(mesh(t));
    this.head = joint(this.torso, 0, 0.6, 0);
    const h = new GeoBuilder();
    h.sphere(0.165, { y: 0.15 }, L.skin, 'hi');
    for (const s of [-1, 1]) h.sphere(0.04, { x: s * 0.165, y: 0.14 }, L.skin, 'lo');
    h.sphere(0.03, { y: 0.12, z: 0.165 }, shadeHex(L.skin, 0.92), 'lo');
    hair(h, L);
    if (L.beard) {
      h.sphere(0.13, { y: 0.07, z: 0.05, sy: 0.7, sz: 0.95 }, L.hair);
    }
    this.head.add(mesh(h));
    for (const s of [-1, 1]) {
      const e = new GeoBuilder();
      e.sphere(0.022, {}, 0x1e1712, 'lo');
      e.sphere(0.008, { x: 0.005, y: 0.008, z: 0.016 }, 0xffffff, 'lo');
      const em = mesh(e);
      em.position.set(s * 0.06, 0.18, 0.145);
      this.head.add(em);
      this.eyes.push(em);
      const br = new GeoBuilder();
      br.box(0.055, 0.014, 0.012, {}, L.hair);
      const bm = mesh(br);
      bm.position.set(s * 0.06, 0.225, 0.152);
      bm.rotation.z = s * -0.1;
      this.head.add(bm);
    }
    const mo = new GeoBuilder();
    mo.rbox(0.06, 0.018, 0.012, 0.008, {}, 0x8e3b3b);
    this.mouthMesh = mesh(mo);
    this.mouthMesh.position.set(0, 0.085, 0.155);
    this.head.add(this.mouthMesh);
    // Arms.
    for (const s of [-1, 1]) {
      const sh = joint(this.torso, s * 0.255, 0.48, 0);
      const ua = new GeoBuilder();
      ua.sphere(0.075, {}, L.shirt);
      ua.cylU(0.06, 0.24, { y: -0.12 }, L.shirt, 10);
      sh.add(mesh(ua));
      const el = joint(sh, 0, -0.25, 0);
      const fa = new GeoBuilder();
      fa.cylU(0.05, 0.22, { y: -0.11 }, L.skin, 10);
      fa.sphere(0.06, { y: -0.25 }, L.skin);
      el.add(mesh(fa));
      sh.rotation.z = s * 0.08;
      this.shoulders.push(sh);
      this.elbows.push(el);
    }
    // Legs.
    for (const s of [-1, 1]) {
      const th = joint(this.hips, s * 0.1, -0.04, 0);
      const ul = new GeoBuilder();
      ul.cylU(0.08, 0.42, { y: -0.2 }, L.pants, 10);
      th.add(mesh(ul));
      const kn = joint(th, 0, -0.41, 0);
      const ll = new GeoBuilder();
      ll.cylU(0.068, 0.38, { y: -0.19 }, L.skirt ? L.skin : L.pants, 10);
      ll.rbox(0.12, 0.08, 0.24, 0.035, { y: -0.4, z: 0.05 }, L.shoes);
      kn.add(mesh(ll));
      this.thighs.push(th);
      this.knees.push(kn);
    }
    this.carry = joint(this.torso, 0, 0.18, 0.34);
  }

  update(c: { x: number; z: number; facing: number; speed: number; anim: number; animT: number; hold: number[]; stun: number; act?: unknown; sayT?: number }, dt: number) {
    this.time += dt;
    const t = this.time;
    const k = 1 - Math.exp(-dt * 14);
    this.root.position.set(c.x, 0, c.z);
    this.yaw += angleDiff(this.yaw, c.facing) * (1 - Math.exp(-dt * 14));
    this.root.rotation.y = this.yaw;
    const anim = c.anim;
    const run = anim === Anim.Run;
    const moving = anim === Anim.Walk || run;
    this.phase += dt * (run ? 11 : 3 + c.speed * 2.2);
    const ph = this.phase;
    const carrying = c.hold.length > 0;

    let hipsY = 0.9;
    let rootPitch = 0;
    let torsoPitch = 0;
    let torsoYaw = 0;
    let headPitch = 0;
    let headYaw = Math.sin(t * 0.6) * 0.12;
    const sh = [[0, 0, 0], [0, 0, 0]];
    const el = [0, 0];
    const th = [0, 0];
    const kn = [0, 0];

    if (moving) {
      const a = run ? 0.8 : 0.48;
      th[0] = Math.sin(ph) * a;
      th[1] = -Math.sin(ph) * a;
      kn[0] = Math.max(0, -Math.sin(ph)) * (run ? 1.1 : 0.6);
      kn[1] = Math.max(0, Math.sin(ph)) * (run ? 1.1 : 0.6);
      sh[0][0] = -Math.sin(ph) * (run ? 0.9 : 0.45);
      sh[1][0] = Math.sin(ph) * (run ? 0.9 : 0.45);
      el[0] = el[1] = run ? -1.2 : -0.25;
      hipsY += Math.abs(Math.cos(ph)) * (run ? 0.06 : 0.025);
      torsoPitch = run ? 0.22 : 0.04;
      torsoYaw = Math.sin(ph) * 0.12;
      headYaw = 0;
    } else {
      // Idle breathing.
      torsoPitch = Math.sin(t * 2) * 0.012;
      sh[0][0] = sh[1][0] = Math.sin(t * 2) * 0.03;
    }
    if (carrying && anim !== Anim.Slip && anim !== Anim.Throw) {
      sh[0][0] = sh[1][0] = -1.0;
      el[0] = el[1] = -0.55;
      sh[0][2] = 0.25;
      sh[1][2] = -0.25;
    }
    switch (anim) {
      case Anim.Clean: {
        torsoPitch = 0.55;
        hipsY = 0.82;
        th[0] = th[1] = -0.35;
        kn[0] = kn[1] = 0.7;
        sh[0][0] = -1.25 + Math.sin(t * 13) * 0.25;
        sh[1][0] = -1.25 + Math.sin(t * 13 + Math.PI) * 0.25;
        sh[0][2] = 0.2 + Math.cos(t * 13) * 0.2;
        sh[1][2] = -0.2 - Math.cos(t * 13) * 0.2;
        el[0] = el[1] = -0.3;
        headPitch = 0.35;
        break;
      }
      case Anim.Interact: {
        const p = clamp(c.animT / 0.3, 0, 1);
        sh[0][0] = sh[1][0] = -1.3 * Math.sin(p * Math.PI);
        torsoPitch = 0.3 * Math.sin(p * Math.PI);
        headPitch = 0.2;
        break;
      }
      case Anim.Throw: {
        const p = clamp(c.animT / 0.4, 0, 1);
        sh[1][0] = p < 0.4 ? -2.6 * (p / 0.4) : -2.6 + (p - 0.4) / 0.6 * 3.2;
        el[1] = -0.4;
        torsoYaw = -0.4 + p * 0.8;
        break;
      }
      case Anim.Pet: {
        torsoPitch = 0.6;
        hipsY = 0.82;
        kn[0] = kn[1] = 0.5;
        th[0] = th[1] = -0.3;
        sh[1][0] = -1.2 + Math.sin(t * 10) * 0.15;
        el[1] = -0.2;
        headPitch = 0.4;
        break;
      }
      case Anim.Slip: {
        const p = clamp(c.animT / 1.15, 0, 1);
        const fall = p < 0.2 ? p / 0.2 : p < 0.75 ? 1 : 1 - (p - 0.75) / 0.25;
        rootPitch = -1.35 * fall;
        hipsY = 0.9 - 0.62 * fall;
        th[0] = -1.3 * fall;
        th[1] = -0.9 * fall;
        sh[0][0] = sh[1][0] = -2.4 * fall;
        sh[0][2] = 0.6 * fall;
        sh[1][2] = -0.6 * fall;
        break;
      }
      case Anim.Cheer: {
        hipsY += Math.abs(Math.sin(t * 6)) * 0.2;
        sh[0][0] = sh[1][0] = -2.8;
        sh[0][2] = 0.35;
        sh[1][2] = -0.35;
        el[0] = el[1] = -0.2 + Math.sin(t * 12) * 0.2;
        headPitch = -0.2;
        break;
      }
      case Anim.Sad: {
        torsoPitch = 0.3;
        headPitch = 0.55;
        sh[0][2] = -0.05;
        sh[1][2] = 0.05;
        break;
      }
    }
    if (c.stun > 0 && anim !== Anim.Slip) {
      headYaw = Math.sin(t * 20) * 0.3;
    }
    this.hips.position.y += (hipsY - this.hips.position.y) * k;
    this.scaled.rotation.x += (rootPitch - this.scaled.rotation.x) * k;
    dampRot(this.torso, torsoPitch, torsoYaw, 0, k);
    dampRot(this.head, headPitch, headYaw, 0, k);
    for (let i = 0; i < 2; i++) {
      const s = i === 0 ? -1 : 1;
      dampRot(this.shoulders[i], sh[i][0], sh[i][1], s * 0.08 + sh[i][2], k);
      dampRot(this.elbows[i], el[i], 0, 0, k);
      dampRot(this.thighs[i], th[i], 0, 0, k);
      dampRot(this.knees[i], kn[i], 0, 0, k);
    }
    this.blinkT -= dt;
    const closed = this.blinkT < 0.12;
    if (this.blinkT < 0) this.blinkT = 2.5 + Math.random() * 3;
    for (const e of this.eyes) e.scale.y += ((closed ? 0.15 : 1) - e.scale.y) * 0.5;
    const talking = (c.sayT ?? 0) > 1.4;
    this.mouthMesh.scale.y = talking ? 1 + Math.abs(Math.sin(t * 18)) * 2.5 : anim === Anim.Cheer ? 3 : 1;
  }

  carryWorld(out: THREE.Vector3): THREE.Vector3 {
    return this.carry.getWorldPosition(out);
  }
}

function shadeHex(hex: number, k: number): THREE.Color {
  const c = new THREE.Color(hex);
  c.r *= k;
  c.g *= k;
  c.b *= k;
  return c;
}

function hair(h: GeoBuilder, L: HumanLook) {
  const c = L.hair;
  switch (L.hairStyle) {
    case 'ponytail':
      h.sphere(0.178, { y: 0.19, z: -0.02, sy: 0.85 }, c);
      h.sphere(0.09, { y: 0.21, z: -0.19 }, c);
      h.sphere(0.075, { y: 0.1, z: -0.24, sy: 1.6 }, c);
      h.box(0.2, 0.05, 0.1, { y: 0.26, z: 0.11, rx: 0.4 }, c);
      break;
    case 'short':
      h.sphere(0.175, { y: 0.21, z: -0.02, sy: 0.7 }, c);
      h.box(0.26, 0.05, 0.08, { y: 0.28, z: 0.1, rx: 0.3 }, c);
      break;
    case 'pigtails':
      h.sphere(0.178, { y: 0.19, z: -0.02, sy: 0.85 }, c);
      for (const s of [-1, 1]) {
        h.sphere(0.07, { x: s * 0.17, y: 0.14, z: -0.04 }, c);
        h.sphere(0.06, { x: s * 0.2, y: 0.05, z: -0.04, sy: 1.5 }, c);
        h.sphere(0.025, { x: s * 0.17, y: 0.19, z: -0.02 }, 0xff6b9a);
      }
      h.box(0.22, 0.05, 0.1, { y: 0.27, z: 0.1, rx: 0.4 }, c);
      break;
    case 'curly':
      for (let i = 0; i < 12; i++) {
        const a = (i / 12) * Math.PI * 2;
        h.ico(0.075, { x: Math.cos(a) * 0.12, y: 0.24 + Math.sin(i * 1.7) * 0.03, z: Math.sin(a) * 0.12 - 0.02 }, c);
      }
      h.ico(0.1, { y: 0.3, z: -0.02 }, c);
      break;
    case 'cap':
      h.sphere(0.175, { y: 0.2, z: -0.02, sy: 0.75 }, c);
      h.cyl(0.17, 0.18, 0.1, { y: 0.29 }, 0x2d5fa8, 14);
      h.box(0.2, 0.02, 0.14, { y: 0.25, z: 0.18 }, 0x2d5fa8);
      h.box(0.08, 0.04, 0.01, { y: 0.31, z: 0.17 }, 0xf6c445);
      break;
  }
}

// ============================================================================
// Cat
// ============================================================================

const CAT_FUR = 0x2f2f36;
const CAT_WHITE = 0xf3f1ec;

export class CatModel {
  readonly root = new THREE.Group();
  private body: THREE.Group;
  private head: THREE.Group;
  private tail: THREE.Group[] = [];
  private legs: THREE.Group[] = [];
  private mouthOpen: THREE.Mesh;
  private phase = 0;
  private time = 0;
  private yaw = 0;
  private shadow: THREE.Mesh;

  constructor() {
    this.shadow = blobShadow(0.25);
    this.root.add(this.shadow);
    this.body = joint(this.root, 0, 0.24, 0);
    const b = new GeoBuilder();
    b.sphere(0.5, { sx: 0.22, sy: 0.21, sz: 0.48 }, CAT_FUR, 'hi');
    b.sphere(0.1, { y: -0.02, z: 0.14, sx: 1.0, sy: 1.0 }, CAT_WHITE);
    this.body.add(mesh(b));
    this.head = joint(this.body, 0, 0.1, 0.24);
    const h = new GeoBuilder();
    h.sphere(0.11, { y: 0.03, sx: 1.12 }, CAT_FUR, 'hi');
    h.sphere(0.06, { y: -0.01, z: 0.08, sx: 1.3, sy: 0.8 }, CAT_WHITE);
    h.sphere(0.016, { y: 0.015, z: 0.13 }, 0xf4a3b5, 'lo');
    for (const s of [-1, 1]) {
      h.cone(0.045, 0.09, { x: s * 0.07, y: 0.12, z: -0.01, rz: -s * 0.25 }, CAT_FUR);
      h.cone(0.025, 0.05, { x: s * 0.07, y: 0.11, z: 0.005, rz: -s * 0.25 }, 0xf4a3b5);
      h.sphere(0.026, { x: s * 0.045, y: 0.05, z: 0.09 }, 0x9be36a, 'lo');
      h.box(0.008, 0.035, 0.01, { x: s * 0.045, y: 0.05, z: 0.113 }, 0x111111);
      for (const w of [-1, 1]) h.box(0.12, 0.004, 0.004, { x: s * 0.09, y: 0.0 + w * 0.012, z: 0.1, rz: s * w * 0.15 }, 0xffffff);
    }
    this.head.add(mesh(h));
    const mo = new GeoBuilder();
    mo.sphere(0.025, { sy: 0.6 }, 0x7a2f3a, 'lo');
    this.mouthOpen = mesh(mo);
    this.mouthOpen.position.set(0, -0.03, 0.115);
    this.mouthOpen.visible = false;
    this.head.add(this.mouthOpen);
    const legPos: [number, number, number][] = [[0.07, -0.05, 0.14], [-0.07, -0.05, 0.14], [0.07, -0.05, -0.15], [-0.07, -0.05, -0.15]];
    for (const [x, y, z] of legPos) {
      const l = joint(this.body, x, y, z);
      const lb = new GeoBuilder();
      lb.cylU(0.028, 0.17, { y: -0.08 }, CAT_FUR, 8);
      lb.sphere(0.032, { y: -0.17, z: 0.01, sy: 0.6 }, CAT_WHITE, 'lo');
      l.add(mesh(lb));
      this.legs.push(l);
    }
    let parent: THREE.Object3D = this.body;
    let z = -0.22;
    let y = 0.05;
    for (let i = 0; i < 4; i++) {
      const tj = joint(parent, 0, y, z);
      const tb = new GeoBuilder();
      tb.cylU(0.025 - i * 0.003, 0.12, { y: 0.06 }, i === 3 ? CAT_WHITE : CAT_FUR, 8);
      tj.add(mesh(tb));
      this.tail.push(tj);
      parent = tj;
      z = 0;
      y = 0.12;
    }
  }

  update(cat: CatState, dt: number) {
    this.time += dt;
    const t = this.time;
    const k = 1 - Math.exp(-dt * 14);
    this.root.position.set(cat.x, cat.y, cat.z);
    this.yaw += angleDiff(this.yaw, cat.facing) * (1 - Math.exp(-dt * 12));
    this.root.rotation.y = this.yaw;
    this.shadow.visible = cat.y < 0.2;
    const moving = cat.speed > 0.1;
    const fleeing = cat.mode === 'flee';
    this.phase += dt * (fleeing ? 16 : 7) * (moving ? 1 : 0);
    const ph = this.phase;
    const legs = [0, 0, 0, 0];
    let bodyY = 0.24;
    let bodyPitch = 0;
    let bodyScaleY = 1;
    let headPitch = 0;
    let tailUp = -0.25;
    let tailSway = Math.sin(t * 2) * 0.3;
    const hiss = cat.hissT > 0;
    if (moving) {
      const a = fleeing ? 0.9 : 0.5;
      legs[0] = Math.sin(ph) * a;
      legs[3] = Math.sin(ph) * a;
      legs[1] = Math.sin(ph + Math.PI) * a;
      legs[2] = Math.sin(ph + Math.PI) * a;
      bodyY += Math.abs(Math.sin(ph)) * 0.02;
      tailUp = fleeing ? -1.2 : -0.35;
      if (cat.jump) {
        legs[0] = legs[1] = -0.9;
        legs[2] = legs[3] = 0.9;
        bodyPitch = -0.2;
      }
    } else {
      // Sitting loaf.
      bodyPitch = -0.35;
      bodyY = 0.2;
      legs[2] = legs[3] = -1.3;
      legs[0] = legs[1] = 0.3;
      headPitch = 0.3;
      tailUp = 0.9;
    }
    if (hiss) {
      bodyPitch = 0;
      bodyY = 0.28;
      bodyScaleY = 1.25;
      headPitch = 0.2;
      tailUp = -1.4;
      tailSway = Math.sin(t * 30) * 0.1;
    }
    this.mouthOpen.visible = hiss;
    this.body.position.y += (bodyY - this.body.position.y) * k;
    this.body.scale.y += (bodyScaleY - this.body.scale.y) * k;
    dampRot(this.body, bodyPitch, 0, 0, k);
    dampRot(this.head, -headPitch, Math.sin(t * 0.9) * 0.2, 0, k);
    this.legs.forEach((l, i) => dampRot(l, legs[i], 0, 0, fleeing ? 0.7 : k));
    this.tail.forEach((tj, i) => {
      dampRot(tj, i === 0 ? tailUp : 0.25 + (hiss ? 0 : 0.1), tailSway * (i + 1) * 0.4, 0, k);
      const s = hiss ? 1.6 : 1;
      tj.scale.x += (s - tj.scale.x) * k;
      tj.scale.z += (s - tj.scale.z) * k;
    });
  }
}

export function worldPos(o: THREE.Object3D): THREE.Vector3 {
  return o.getWorldPosition(tmpV);
}
