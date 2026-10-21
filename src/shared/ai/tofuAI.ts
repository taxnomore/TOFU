// AI for Tofu: picks mischief by utility (secrets, distance, humans nearby),
// steals and stashes things, knocks objects over, rolls in mud and runs inside,
// chases the cat, flees from humans, uses zoomies and acts innocent.
import { BTN_BARK, BTN_INTERACT, BTN_SIT, BTN_SPECIAL, BTN_SPRINT, DOG } from '../constants';
import { Rng, dist } from '../math';
import { ITEM_TYPES } from '../world/itemTypes';
import { makeDef } from '../world/types';
import type { Game } from '../sim/game';
import { IKind, listInteractions } from '../sim/interactions';
import { TASK_DEFS } from '../sim/rules';
import type { Character, InputFrame } from '../sim/types';
import { EMPTY_INPUT } from '../sim/types';
import { Navigator } from './navigator';
import type { AIController } from './ai';

type Kind = 'act' | 'mud' | 'muddy_run' | 'leak' | 'cat' | 'flee' | 'street' | 'innocent' | 'bark' | 'bump' | 'wander';

interface Goal {
  key: string;
  kind: Kind;
  want?: { kind: IKind; target: number };
  x: number;
  z: number;
  track?: () => { x: number; z: number } | null;
  sprint?: boolean;
  timeout: number;
  item?: number;
  bark?: () => boolean;
}

const DIFF = [
  { decide: 1.4, random: 22, flee: 0.25, zoomSmart: false, undo: 0.2, idle: 0.4, linger: [3, 6], sprint: 0.2 },
  { decide: 0.8, random: 10, flee: 0.7, zoomSmart: true, undo: 0.45, idle: 0.22, linger: [1.6, 3.6], sprint: 0.45 },
  { decide: 0.4, random: 4, flee: 1, zoomSmart: true, undo: 1.1, idle: 0.05, linger: [0.3, 1.0], sprint: 1 },
];


export class TofuAI implements AIController {
  private nav: Navigator;
  private goal: Goal | null = null;
  /** Stations whose content undoes a job of this round when stolen. */
  private taskStations: Set<string>;
  private decideT = 0;
  private goalT = 0;
  private prevInteract = false;
  private prevSpecial = false;
  private prevBark = false;
  private recent = new Map<string, number>();
  private wpIdx = 0;
  private noAvailT = 0;
  /** Proud pause after a successful bit of mischief (gives humans a chance). */
  private lingerT = 0;
  private lastChaos = 0;
  private p: (typeof DIFF)[number];
  private dt = 1 / 60;

  constructor(readonly g: Game, readonly id: number, difficulty: number, readonly rng: Rng) {
    this.nav = new Navigator(g, id, rng);
    this.p = DIFF[Math.max(0, Math.min(2, difficulty))];
    this.taskStations = new Set();
    for (const kind of g.map.taskIds) {
      const spec = TASK_DEFS[kind].spec;
      if (spec.type === 'collect') {
        this.taskStations.add(spec.dest);
        for (const s of g.map.stations) if ((spec.kinds as string[]).includes(s.kind)) this.taskStations.add(s.id);
      } else if (spec.type === 'deliver') this.taskStations.add(spec.dest);
    }
  }

  private get spots(): [number, number, string][] {
    return this.g.map.ai.indoorSpots;
  }

  get me(): Character {
    return this.g.state.chars[this.id];
  }

  private nearestHuman(x: number, z: number): { d: number; c: Character | null } {
    let best = Infinity;
    let bc: Character | null = null;
    for (const c of this.g.state.chars) {
      if (c.role !== 'human') continue;
      const d = dist(c.x, c.z, x, z);
      if (d < best) {
        best = d;
        bc = c;
      }
    }
    return { d: best, c: bc };
  }

  private risk(x: number, z: number): number {
    const { d } = this.nearestHuman(x, z);
    return d < 6 ? (6 - d) * 4.5 : 0;
  }

  private secret(id: string): boolean {
    return this.g.state.secrets.some((s) => s.id === id && !s.done);
  }

  think(): InputFrame {
    const g = this.g;
    const S = g.state;
    const me = this.me;
    const dt = this.dt;
    if (S.phase !== 'play' || me.stun > 0 || me.lureKind) {
      this.prevInteract = false;
      return EMPTY_INPUT;
    }
    for (const [k, t] of this.recent) if (t < S.time) this.recent.delete(k);
    if (S.chaos >= this.lastChaos + 1.4 && me.hold.length === 0 && this.goal?.kind !== 'flee') {
      this.lingerT = this.p.linger[0] + this.rng.next() * (this.p.linger[1] - this.p.linger[0]);
      this.goal = null;
    }
    this.lastChaos = S.chaos;
    if (this.lingerT > 0) {
      this.lingerT -= dt;
      const near = this.nearestHuman(me.x, me.z);
      if (near.d > 3.5) return this.out(0, 0, this.lingerT > 0.8 ? BTN_SIT : 0);
      this.lingerT = 0;
    }
    this.decideT -= dt;
    this.goalT += dt;
    // React fast to an approaching human while carrying something.
    const nh = this.nearestHuman(me.x, me.z);
    const threatened = me.hold.length > 0 && nh.d < 3.2 && this.rng.next() < this.p.flee * dt * 8;
    if (threatened && this.goal?.kind !== 'flee') this.goal = null;
    if (this.decideT <= 0 || !this.goal || this.goalT > this.goal.timeout || this.goalDone()) {
      this.decideT = this.p.decide;
      const next = threatened ? this.fleeGoal() : this.choose();
      if (!this.goal || !next || next.key !== this.goal.key) {
        this.goal = next;
        this.goalT = 0;
        this.noAvailT = 0;
        if (next) this.nav.setGoal(next.x, next.z, next.kind === 'mud' ? 0.5 : 0.7, true);
      }
    }
    const goal = this.goal;
    if (!goal) return this.out(0, 0, 0);
    if (goal.track) {
      const p = goal.track();
      if (!p) {
        this.goal = null;
        return this.out(0, 0, 0);
      }
      goal.x = p.x;
      goal.z = p.z;
      this.nav.setGoal(p.x, p.z, this.nav.reach);
    }
    let buttons = 0;
    let pick: InputFrame['pick'];
    let mx = 0;
    let mz = 0;

    // Zoomies.
    if (me.zoom >= 1 && me.zoomT <= 0 && !this.prevSpecial) {
      const smart = this.p.zoomSmart;
      const knockables = S.items.filter((it) => it.state === 'home' && ITEM_TYPES[it.type].knock && it.y < 0.1 && dist(it.x, it.z, me.x, me.z) < 7).length;
      if (!smart || goal.kind === 'flee' || knockables >= 2 || (g.map.messy(me.x, me.z) && this.rng.next() < 0.02)) buttons |= BTN_SPECIAL;
    }

    if (goal.kind === 'innocent') {
      buttons |= BTN_SIT;
      return this.out(0, 0, buttons);
    }

    const list = listInteractions(g, me);
    const want = goal.want;
    const avail = want ? list.find((l) => l.kind === want.kind && l.target === want.target) : undefined;
    if (avail && goal.kind !== 'bump') {
      pick = { kind: avail.kind, target: avail.target };
      if (avail.hold > 0) {
        if (me.act && me.act.kind === avail.kind && me.act.target === avail.target) buttons |= BTN_INTERACT;
        else if (!this.prevInteract) buttons |= BTN_INTERACT;
      } else if (!this.prevInteract) {
        buttons |= BTN_INTERACT;
      }
      this.noAvailT = 0;
      if (avail.kind === 'drop' || avail.kind === 'stash' || avail.kind === 'take' || avail.kind === 'pickup') this.recent.set(goal.key, S.time + 6);
    } else {
      if (goal.kind === 'bump' && goal.item !== undefined) {
        // Line up and run straight into it.
        const it = S.items[goal.item];
        const d = dist(me.x, me.z, it.x, it.z);
        if (d < 2.6 && this.g.world.dogNav.lineClear(me.x, me.z, it.x, it.z)) {
          mx = (it.x - me.x) / d;
          mz = (it.z - me.z) / d;
          buttons |= BTN_SPRINT;
          if (avail && d < 1.0) {
            pick = { kind: avail.kind, target: avail.target };
            if (!this.prevInteract) buttons |= BTN_INTERACT;
          }
          return this.out(mx, mz, buttons, pick);
        }
      }
      const st = this.nav.update(dt);
      mx = st.mx;
      mz = st.mz;
      if (st.door >= 0) {
        const di = list.find((l) => l.kind === 'push_door' && l.target === st.door);
        if (di) {
          pick = { kind: 'push_door', target: st.door };
          if (me.act?.kind === 'push_door' || !this.prevInteract) buttons |= BTN_INTERACT;
          mx *= 0.1;
          mz *= 0.1;
        }
      }
      if (st.arrived) {
        this.noAvailT += dt;
        if (goal.want) {
          mx = (goal.x - me.x) * 0.6;
          mz = (goal.z - me.z) * 0.6;
        }
        if (goal.kind === 'street' || goal.kind === 'wander' || goal.kind === 'flee') this.goal = null;
        if (goal.kind === 'muddy_run' || goal.kind === 'leak') this.nextWaypoint();
      }
      if (st.failed || (goal.want && this.noAvailT > 1.6)) {
        this.recent.set(goal.key, S.time + 10);
        this.goal = null;
      }
      const far = st.dist > 8 && this.rng.next() < this.p.sprint;
      if (goal.sprint || (far && me.stamina > 0.7) || (nh.d < 4 && me.hold.length)) buttons |= BTN_SPRINT;
    }
    // Barking opportunities.
    if (goal.bark?.() && !this.prevBark) buttons |= BTN_BARK;
    return this.out(mx, mz, buttons, pick);
  }

  private out(mx: number, mz: number, buttons: number, pick?: InputFrame['pick']): InputFrame {
    this.prevInteract = (buttons & BTN_INTERACT) !== 0;
    this.prevSpecial = (buttons & BTN_SPECIAL) !== 0;
    this.prevBark = (buttons & BTN_BARK) !== 0;
    return { mx, mz, buttons, pick };
  }

  private goalDone(): boolean {
    const g = this.goal;
    if (!g) return true;
    const me = this.me;
    const S = this.g.state;
    switch (g.kind) {
      case 'mud':
        return me.mud > 0.9;
      case 'muddy_run':
        return me.mud < 0.12;
      case 'leak':
        return !me.hold.some((i) => S.items[i].type === 'watering_can' && S.items[i].charge > 0);
      case 'cat':
        return S.cat.y > 0.35 && S.cat.edgeTo < 0 && dist(me.x, me.z, S.cat.x, S.cat.z) > 3;
      case 'flee':
        return this.nearestHuman(me.x, me.z).d > 7;
      case 'street':
      case 'act':
        if (g.want?.kind === 'take' || g.want?.kind === 'pickup') return me.hold.length > 0 || S.items[g.want.target].holder >= 0;
        if (g.want?.kind === 'stash' || g.want?.kind === 'drop' || g.want?.kind === 'eat') return me.hold.length === 0;
        if (g.want?.kind === 'knock' || g.want?.kind === 'push_bin') return S.items[g.want.target].state !== 'home';
        return false;
      case 'bump':
        return g.item !== undefined && S.items[g.item].state !== 'home';
      case 'innocent':
        return this.goalT > 3;
      default:
        return false;
    }
  }

  private fleeGoal(): Goal {
    const me = this.me;
    const nh = this.nearestHuman(me.x, me.z);
    const escapes = this.g.map.ai.escapes;
    let best: [number, number] = escapes[0];
    let bs = -Infinity;
    for (const e of escapes) {
      const dh = nh.c ? dist(e[0], e[1], nh.c.x, nh.c.z) : 10;
      const dm = dist(e[0], e[1], me.x, me.z);
      // Prefer escapes that are not behind the human.
      const toE = nh.c ? (e[0] - me.x) * (nh.c.x - me.x) + (e[1] - me.z) * (nh.c.z - me.z) : 0;
      const s = dh - dm * 0.3 - (toE > 0 ? 8 : 0) + this.rng.next() * 2;
      if (s > bs) {
        bs = s;
        best = e;
      }
    }
    return { key: 'flee', kind: 'flee', x: best[0], z: best[1], sprint: true, timeout: 4 };
  }

  private nextWaypoint() {
    if (!this.goal) return;
    const bedrooms = this.secret('boue_chambre');
    const muddy = this.g.map.muddyZones;
    const spots = bedrooms ? this.spots.filter((s) => muddy.includes(s[2]) || this.rng.next() < 0.3) : this.spots;
    this.wpIdx = (this.wpIdx + 1 + Math.floor(this.rng.next() * 3)) % spots.length;
    const [x, z] = spots[this.wpIdx % spots.length];
    this.goal.x = x;
    this.goal.z = z;
    this.nav.setGoal(x, z, 0.8, true);
  }

  private choose(): Goal | null {
    const g = this.g;
    const S = g.state;
    const me = this.me;
    const cands: { u: number; goal: Goal }[] = [];
    const R = this.p.random;
    const add = (u: number, goal: Goal) => {
      if (this.recent.has(goal.key)) u -= 30;
      cands.push({ u: u + this.rng.next() * R, goal });
    };
    const guests = S.guestsT > 0;
    const tasksDone = S.tasks.filter((t) => t.done).length;
    // A less focused dog sometimes just sniffs around or sits.
    if (!me.hold.length && !guests && this.rng.next() < this.p.idle) {
      if (this.rng.next() < 0.5) return { key: `sniff:${S.tick}`, kind: 'innocent', x: me.x, z: me.z, timeout: 2.5 };
      const w = this.spots[Math.floor(this.rng.next() * this.spots.length)];
      return { key: `sniff:${S.tick}`, kind: 'wander', x: w[0], z: w[1], timeout: 6 };
    }

    // --- Holding something ---
    if (me.hold.length) {
      const it = S.items[me.hold[0]];
      const t = ITEM_TYPES[it.type];
      const nh = this.nearestHuman(me.x, me.z);
      if (t.edible) {
        if (nh.d > 6) add(85, { key: 'eat', kind: 'act', want: { kind: 'eat', target: it.idx }, x: me.x, z: me.z, timeout: 5 });
        else return this.fleeGoal();
      }
      if (t.category === 'ball') {
        add(70, { key: 'dropball', kind: 'act', want: { kind: 'drop', target: it.idx }, x: me.x, z: me.z, timeout: 3 });
      }
      g.map.stations.forEach((s, si) => {
        if (s.kind !== 'dog_basket') return;
        const d = dist(me.x, me.z, s.x, s.z);
        add(66 + (this.secret('tresor') ? 18 : 0) - d * 0.7 - this.risk(s.x, s.z) - (it.stashed ? 30 : 0), {
          key: `stash:${si}`, kind: 'act', want: { kind: 'stash', target: si }, x: s.x, z: s.z, timeout: 20,
        });
      });
      const fromProperty = it.grabbedIn && !g.map.outsideZones.includes(it.grabbedIn);
      if (fromProperty && !it.streetScored) {
        for (const [x, z] of g.map.ai.streetDrops) {
          const d = dist(me.x, me.z, x, z);
          add(52 + (this.secret('rue') ? 40 : 0) - d * 0.6 - this.risk(x, z), {
            key: `street:${x}`, kind: 'street', want: { kind: 'drop', target: it.idx }, x, z, timeout: 25,
          });
        }
      }
      // The stolen watering can: run around the house so it leaks everywhere.
      if (it.type === 'watering_can' && it.charge > 0) {
        const sp = this.spots[this.wpIdx % this.spots.length];
        add(72 + (this.secret('arrosoir') ? 25 : 0) - this.risk(me.x, me.z) * 0.5, { key: 'leak', kind: 'leak', x: sp[0], z: sp[1], timeout: 25 });
      }
      if (it.type === 'baguette' && this.secret('baguette')) {
        const si = g.map.stations.findIndex((s) => s.kind === 'dog_basket' && !g.map.outsideZones.includes(g.map.zoneAt(s.x, s.z)?.id ?? ''));
        const s = g.map.stations[si];
        if (s) add(95, { key: 'baguette-home', kind: 'act', want: { kind: 'stash', target: si }, x: s.x, z: s.z, timeout: 30 });
      }
    } else {
      // --- Steal things ---
      for (const it of S.items) {
        const t = ITEM_TYPES[it.type];
        if (!t.carry?.dog || t.category === 'ball' || it.guardT > 0) continue;
        let base = 0;
        let want: IKind;
        if (it.state === 'stored') {
          const s = g.map.stations[it.station];
          if (!s.dogReach || s.kind === 'dog_basket' || g.state.stations[it.station].disabled) continue;
          want = 'take';
          base = t.category === 'laundry' ? 46 : t.category === 'food' ? 48 : t.category === 'toy' ? 34 : 32;
          // Undo finished jobs (very annoying for humans).
          const taskStation = this.taskStations.has(s.id);
          if (taskStation) base += (6 + tasksDone * 3) * this.p.undo + (guests ? 50 : 0);
        } else if (it.state === 'free') {
          want = 'pickup';
          base = it.disturbed ? 20 : 38;
        } else continue;
        if (t.category === 'laundry' && this.secret('voleur')) base += 22;
        if (t.edible && this.secret('gourmand')) base += 18;
        if (it.type === 'baguette') base += this.secret('baguette') ? 45 : -10;
        if (it.type === 'toilet_roll') base += it.charge > 0 ? (this.secret('papier') ? 40 : 0) : -40;
        if (it.type === 'watering_can') {
          // Even better while the humans still have flowers to water.
          const flowers = S.tasks.some((tk) => TASK_DEFS[tk.kind].spec.type === 'water' && !tk.done);
          base += it.charge > 0 ? 6 + (flowers ? 8 : 0) + (this.secret('arrosoir') ? 30 : 0) : -40;
        }
        if (t.category === 'market') base += 10 + (this.secret('marche') ? 25 : 0);
        const d = dist(me.x, me.z, it.x, it.z);
        add(base - d * 0.8 - this.risk(it.x, it.z), { key: `item:${it.idx}`, kind: 'act', want: { kind: want, target: it.idx }, x: it.x, z: it.z, timeout: 22 });
      }
      // --- Knock things over ---
      for (const it of S.items) {
        if (it.state !== 'home' || it.knockCd > 0) continue;
        const t = ITEM_TYPES[it.type];
        // Too high for him (the cat's job).
        if (!t.knock || it.y > DOG.knockReachY) continue;
        const d = dist(me.x, me.z, it.x, it.z);
        const isBin = it.type.includes('bin');
        let base = isBin ? 38 : 36;
        if (this.secret('casse')) base += 18;
        if (isBin && this.secret('poubelles')) base += 22;
        if (it.type === 'leaf_pile' && this.secret('feuilles')) base += 25;
        if (it.type === 'snowman') base += this.secret('bonhomme') ? 30 : 4;
        if (g.map.messy(it.x, it.z)) base += 4;
        const bump = it.y < 0.1 && t.knock.push <= 0 && t.knock.minSpeed < 7;
        const want: IKind = t.knock.push > 0 ? 'push_bin' : 'knock';
        add(base - d * 0.8 - this.risk(it.x, it.z), {
          key: `knock:${it.idx}`, kind: bump ? 'bump' : 'act', item: it.idx, want: { kind: want, target: it.idx }, x: it.x, z: it.z, timeout: 18,
        });
      }
      // --- Robot vacuum: switch it on and let it wreak havoc ---
      if (S.vacuum.mode === 'dock' && S.vacuum.t <= 0) {
        const v = S.vacuum;
        const dv = dist(me.x, me.z, v.x, v.z);
        // Better with fragile things on the floor nearby: they will fall (chain reaction).
        let fragile = 0;
        for (const it of S.items) {
          const k = ITEM_TYPES[it.type].knock;
          if (it.state === 'home' && it.y < 0.3 && k && k.push <= 0 && dist(it.x, it.z, v.x, v.z) < 4) fragile++;
        }
        add(34 + Math.min(12, fragile * 6) + (this.secret('chaine') ? 20 : 0) - dv * 0.8 - this.risk(v.x, v.z), { key: 'vacuum', kind: 'act', want: { kind: 'vacuum', target: 0 }, x: v.x, z: v.z, timeout: 15 });
      }

      // --- Stations: bed, sofa, flowerbeds, tablecloth, trash bag ---
      g.map.stations.forEach((s, si) => {
        const st = S.stations[si];
        const d = dist(me.x, me.z, s.x, s.z);
        if (s.kind === 'bed' && (st.made || (me.mud > 0.3 && !!makeDef(s).mess && !g.makeDirty(si))) && me.bedCd <= 0) {
          const muddy = me.mud > 0.3 && !!makeDef(s).mess;
          add(34 + (st.made ? 10 : 0) + (muddy ? 14 : 0) + (muddy && this.secret('lit_sale') ? 40 : 0) - d * 0.8 - this.risk(s.x, s.z), {
            key: `bed:${si}`, kind: 'act', want: { kind: 'bed_jump', target: si }, x: s.x, z: s.z, timeout: 18,
          });
        }
        if (s.kind === 'sofa' && me.bedCd <= 0 && S.items.some((it) => it.type === 'cushion' && it.state === 'home')) {
          add(28 - d * 0.8 - this.risk(s.x, s.z), { key: `sofa:${si}`, kind: 'act', want: { kind: 'sofa_jump', target: si }, x: s.x, z: s.z, timeout: 15 });
        }
        if (s.kind === 'flowerbed' && !st.dug) {
          add(30 + (this.secret('creuse') ? 30 : 0) + (st.watered ? 6 : 0) - d * 0.8 - this.risk(s.x, s.z), {
            key: `dig:${si}`, kind: 'act', want: { kind: 'dig', target: si }, x: s.x, z: s.z, timeout: 20,
          });
        }
        if (s.kind === 'dining_table' && st.items.some((i) => S.items[i].type === 'dishes')) {
          add(44 + (guests ? 40 : 0) - d * 0.8 - this.risk(s.x, s.z), { key: `cloth:${si}`, kind: 'act', want: { kind: 'tablecloth', target: si }, x: s.x, z: s.z, timeout: 18 });
        }
      });
      const bag = S.items.find((it) => ITEM_TYPES[it.type].rip && it.state === 'free' && it.charge <= 0);
      if (bag) {
        const d = dist(me.x, me.z, bag.x, bag.z);
        add(36 + (this.secret('poubelles') ? 18 : 0) - d * 0.8 - this.risk(bag.x, bag.z), { key: 'rip', kind: 'act', want: { kind: 'rip', target: bag.idx }, x: bag.x, z: bag.z, timeout: 15 });
      }
      // --- Mud ---
      if (me.mud < 0.2) {
        const mudCells = S.messes.filter((m) => m.kind === 'mud').length;
        const bonus = (this.secret('boue_chambre') ? 28 : 0) + (this.secret('lit_sale') ? 22 : 0);
        for (const p of g.map.puddles) {
          const d = dist(me.x, me.z, p.x, p.z);
          add(32 + bonus - mudCells * 3 - d * 0.6, { key: `mud:${p.id}`, kind: 'mud', x: p.x, z: p.z, timeout: 25 });
        }
      } else {
        // Dirty paws: go and leave prints inside (snowy paws are less of a feat).
        const sp = this.spots[this.wpIdx % this.spots.length];
        const base = me.pawKind === 'snow' ? 34 : 60;
        add(base + (me.pawKind === 'mud' && this.secret('boue_chambre') ? 20 : 0), { key: 'muddy_run', kind: 'muddy_run', x: sp[0], z: sp[1], timeout: 22, sprint: false });
      }
    }
    // --- Cat ---
    const cat = S.cat;
    const dc = dist(me.x, me.z, cat.x, cat.z);
    if (cat.y < 0.35 && dc < 22 && !me.hold.length) {
      // Indoors, a chased cat jumps onto the counter and knocks things over.
      const chain = g.map.messy(cat.x, cat.z) ? 10 + (this.secret('chaine') ? 25 : 0) : 0;
      add(36 + chain + (this.secret('chat') ? 32 : 0) - dc * 0.9, {
        key: 'cat', kind: 'cat', x: cat.x, z: cat.z, sprint: dc < 9, timeout: 10,
        track: () => ({ x: S.cat.x, z: S.cat.z }),
      });
    } else if (cat.y > 0.35 && cat.edgeTo < 0 && dc < 9 && cat.barkCd <= 0) {
      add(30 - dc, {
        key: 'barkcat', kind: 'bark', x: cat.x, z: cat.z, timeout: 5,
        bark: () => dist(this.me.x, this.me.z, S.cat.x, S.cat.z) < 6,
      });
    }
    // --- Mail carrier ---
    if (S.carrier.active && S.carrier.barkCd <= 0) {
      const d = dist(me.x, me.z, S.carrier.x, S.carrier.z);
      if (d < 30) {
        add(26 + (this.secret('facteur') ? 45 : 0) - d * 0.7, {
          key: 'carrier', kind: 'bark', x: S.carrier.x, z: S.carrier.z - 1.5, timeout: 12,
          track: () => (S.carrier.active ? { x: S.carrier.x + 1, z: S.carrier.z - 1.2 } : null),
          bark: () => dist(this.me.x, this.me.z, S.carrier.x, S.carrier.z) < 6,
        });
      }
    }
    // --- Startle cleaning humans ---
    for (const h of S.chars) {
      if (h.role !== 'human' || !h.act || h.startleCd > 0) continue;
      const d = dist(me.x, me.z, h.x, h.z);
      if (d < 14) {
        add(24 + (this.secret('aboie') ? 40 : 0) - d * 1.2, {
          key: `startle:${h.id}`, kind: 'bark', x: h.x, z: h.z, timeout: 6,
          track: () => ({ x: h.x, z: h.z }),
          bark: () => dist(this.me.x, this.me.z, h.x, h.z) < 3.8 && !!h.act,
        });
      }
    }
    // --- Innocent sit near our own mess ---
    if (this.secret('innocent')) {
      for (const m of S.messes) {
        if (!m.byTofu || me.innocentDone.includes(m.id)) continue;
        const d = dist(me.x, me.z, m.x, m.z);
        if (d < 2.5 && this.nearestHuman(me.x, me.z).d > 3) add(75, { key: `innocent:${m.id}`, kind: 'innocent', x: me.x, z: me.z, timeout: 3.2 });
      }
    }
    // --- Wander ---
    const w = this.spots[Math.floor(this.rng.next() * this.spots.length)];
    add(8, { key: `wander:${w[0]}`, kind: 'wander', x: w[0], z: w[1], timeout: 8 });
    if (!cands.length) return null;
    cands.sort((a, b) => b.u - a.u);
    return cands[0].goal;
  }

  setDt(dt: number) {
    this.dt = dt;
  }
}

