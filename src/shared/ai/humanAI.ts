// AI for the humans: chase Tofu to recover stolen objects, clean messes, do the
// household jobs, refill treats, close doors behind them, coordinate with the
// other human through shared claims.
import { BTN_INTERACT, BTN_SPECIAL, BTN_SPRINT, HUMAN } from '../constants';
import { Rng, angleDiff, dist } from '../math';
import { ITEM_TYPES, MESS_TYPES, isTrail } from '../world/itemTypes';
import type { Game } from '../sim/game';
import { IKind, listInteractions } from '../sim/interactions';
import { objectivesFor } from '../sim/objectives';
import { TASK_DEFS } from '../sim/rules';
import type { Character, InputFrame, Item } from '../sim/types';
import { EMPTY_INPUT } from '../sim/types';
import { Navigator } from './navigator';
import type { AIController, Claims } from './ai';

interface Goal {
  key: string;
  /** Interaction we want to perform when in reach. */
  want: { kind: IKind; target: number } | null;
  x: number;
  z: number;
  /** Re-evaluated target position each tick (moving targets). */
  track?: () => { x: number; z: number } | null;
  sprint?: boolean;
  timeout: number;
}

const DIFF = [
  { decide: 1.0, react: 1.8, treat: 0.3, chaseMax: 12, careful: 0.5 },
  { decide: 0.5, react: 0.5, treat: 0.65, chaseMax: 20, careful: 0.8 },
  { decide: 0.3, react: 0.2, treat: 0.95, chaseMax: 28, careful: 1 },
];

/** Station whose content Tofu can steal back (or knock over) to undo a finished job. */
function protectStation(g: Game, kind: string): string | null {
  const spec = TASK_DEFS[kind].spec;
  if (spec.type !== 'collect' && spec.type !== 'deliver') return null;
  const s = g.map.stations[g.world.stationIndex.get(spec.dest)!];
  return s.dogReach || s.kind === 'dining_table' ? s.id : null;
}

/** Does this door get closed behind us now (a finished job behind it)? */
function protectedDoor(g: Game, doorId: string): boolean {
  const rule = g.map.ai.protectedDoors[doorId];
  if (!rule) return false;
  return rule === '*' || g.state.tasks.some((t) => t.kind === rule && t.done);
}

export class HumanAI implements AIController {
  private nav: Navigator;
  private goal: Goal | null = null;
  private decideT = 0;
  private prevInteract = false;
  private prevSpecial = false;
  private sawTheftT = 0;
  private blacklist = new Map<string, number>();
  private goalT = 0;
  private noAvailT = 0;
  private p: (typeof DIFF)[number];
  private dt = 1 / 60;

  constructor(readonly g: Game, readonly id: number, difficulty: number, readonly claims: Claims, readonly rng: Rng) {
    this.nav = new Navigator(g, id, rng);
    this.p = DIFF[Math.max(0, Math.min(2, difficulty))];
    this.decideT = rng.next() * 0.5;
  }

  get me(): Character {
    return this.g.state.chars[this.id];
  }

  think(): InputFrame {
    const g = this.g;
    const S = g.state;
    const me = this.me;
    const dt = this.dt;
    if (S.phase !== 'play' || me.stun > 0) {
      this.prevInteract = false;
      return EMPTY_INPUT;
    }
    const now = S.time;
    for (const [k, t] of this.blacklist) if (t < now) this.blacklist.delete(k);
    const tofu = g.tofu;
    if (tofu.hold.length && !this.isBall(tofu.hold[0])) this.sawTheftT += dt;
    else this.sawTheftT = 0;

    this.decideT -= dt;
    this.goalT += dt;
    if (this.decideT <= 0 || !this.goal || this.goalT > (this.goal?.timeout ?? 20)) {
      this.decideT = this.p.decide;
      const next = this.choose();
      if (!this.goal || !next || next.key !== this.goal.key) {
        this.goal = next;
        this.goalT = 0;
        this.noAvailT = 0;
        if (next) this.nav.setGoal(next.x, next.z, 0.6, true);
        else this.nav.clear();
      }
      if (this.goal) this.claims.set(this.id, this.goal.key);
      else this.claims.delete(this.id);
    }
    const goal = this.goal;
    let buttons = 0;
    let pick: InputFrame['pick'];
    let mx = 0;
    let mz = 0;

    // Opportunistic: close a protected door behind us.
    const door = this.doorToClose();
    if (door >= 0 && !me.act) {
      return this.press({ kind: 'door', target: door }, 0, 0, 0);
    }
    if (!goal) {
      this.prevInteract = false;
      return EMPTY_INPUT;
    }
    if (goal.track) {
      const p = goal.track();
      if (!p) {
        this.goal = null;
        return EMPTY_INPUT;
      }
      goal.x = p.x;
      goal.z = p.z;
      this.nav.setGoal(p.x, p.z, 0.6);
    }
    const list = listInteractions(g, me);
    const want = goal.want;
    const avail = want ? list.find((l) => l.kind === want.kind && l.target === want.target) : undefined;
    if (avail) {
      // In reach: stop and act (press, or hold for timed actions).
      pick = { kind: avail.kind, target: avail.target };
      if (avail.hold > 0) {
        if (me.act && me.act.kind === avail.kind && me.act.target === avail.target) buttons |= BTN_INTERACT;
        else if (!this.prevInteract) buttons |= BTN_INTERACT;
      } else if (!this.prevInteract) {
        buttons |= BTN_INTERACT;
      }
      // Face the target a little.
      const dx = avail.x - me.x;
      const dz = avail.z - me.z;
      const l = Math.hypot(dx, dz);
      if (l > 0.3 && !me.act) {
        mx = (dx / l) * 0.15;
        mz = (dz / l) * 0.15;
      }
      this.noAvailT = 0;
    } else {
      const st = this.nav.update(dt);
      if (st.door >= 0) {
        const di = list.find((l) => l.kind === 'door' && l.target === st.door);
        if (di) {
          pick = { kind: 'door', target: st.door };
          if (!this.prevInteract) buttons |= BTN_INTERACT;
        }
      }
      mx = st.mx;
      mz = st.mz;
      if (st.arrived) {
        this.noAvailT += dt;
        // Nudge around to bring the target in reach.
        mx = (goal.x - me.x) * 0.5;
        mz = (goal.z - me.z) * 0.5;
      }
      if (st.failed || this.noAvailT > 1.6) {
        this.blacklist.set(goal.key, S.time + 8);
        this.goal = null;
        this.decideT = 0;
      }
      const far = st.dist > 9 && !this.g.map.messy(me.x, me.z);
      if ((goal.sprint && st.dist > 2) || (far && me.stamina > 0.5 && this.rng.next() < this.p.careful)) {
        buttons |= BTN_SPRINT;
      }
    }

    // Treat / ball throw toward Tofu when chasing.
    if (goal.key === 'recover' || goal.key === 'paws') {
      const d = dist(me.x, me.z, tofu.x, tofu.z);
      const facing = Math.abs(angleDiff(me.facing, Math.atan2(tofu.x - me.x, tofu.z - me.z))) < 0.35;
      const hasBall = me.hold.some((i) => S.items[i].type === 'ball');
      if (facing && d > 2.5 && d < 8 && (hasBall || (me.treats > 0 && me.throwCd <= 0)) && tofu.lureImmune <= 0 && !tofu.lureKind) {
        if (this.rng.next() < this.p.treat * dt * 2 && !this.prevSpecial) buttons |= BTN_SPECIAL;
      }
    }
    this.prevSpecial = (buttons & BTN_SPECIAL) !== 0;
    this.prevInteract = (buttons & BTN_INTERACT) !== 0;
    return { mx, mz, buttons, pick };
  }

  private press(pick: { kind: IKind; target: number }, mx: number, mz: number, extra: number): InputFrame {
    const buttons = this.prevInteract ? extra : BTN_INTERACT | extra;
    this.prevInteract = (buttons & BTN_INTERACT) !== 0;
    return { mx, mz, buttons, pick };
  }

  private isBall(i: number) {
    return this.g.state.items[i]?.type === 'ball';
  }

  private claimedByOther(key: string): boolean {
    for (const [id, k] of this.claims) if (id !== this.id && k === key) return true;
    return false;
  }

  /**
   * A human player (not the computer) is closer to this spot than us and right
   * next to it: they are surely dealing with it, leave it to them.
   */
  private playerOnIt(x: number, z: number): boolean {
    const me = this.me;
    const mine = dist(me.x, me.z, x, z);
    for (const c of this.g.state.chars) {
      if (c.role !== 'human' || c.ai || c.id === this.id) continue;
      const d = dist(c.x, c.z, x, z);
      if (d < 3 && d < mine) return true;
    }
    return false;
  }

  /** Floor objects the robot vacuum could knock over around (x, z). */
  private fragileNear(x: number, z: number, r: number): number {
    let n = 0;
    for (const it of this.g.state.items) {
      if (it.state !== 'home' || it.y > 0.3) continue;
      const k = ITEM_TYPES[it.type].knock;
      if (k && k.push <= 0 && dist(it.x, it.z, x, z) < r) n++;
    }
    return n;
  }

  /** Distance of the closest other human to (x,z). */
  private otherHumanDist(x: number, z: number): number {
    let best = Infinity;
    for (const c of this.g.state.chars) {
      if (c.role !== 'human' || c.id === this.id) continue;
      best = Math.min(best, dist(c.x, c.z, x, z));
    }
    return best;
  }

  private choose(): Goal | null {
    const g = this.g;
    const S = g.state;
    const me = this.me;
    const tofu = g.tofu;
    const cands: { u: number; goal: Goal }[] = [];
    const dT = dist(me.x, me.z, tofu.x, tofu.z);
    const add = (u: number, goal: Goal) => {
      if (this.blacklist.has(goal.key)) return;
      if (this.claimedByOther(goal.key)) u -= 28;
      cands.push({ u, goal });
    };

    // 1. Recover stolen objects from Tofu.
    if (tofu.hold.length && !this.isBall(tofu.hold[0]) && this.sawTheftT > this.p.react && dT < this.p.chaseMax) {
      const otherCloser = this.otherHumanDist(tofu.x, tofu.z) < dT - 3;
      add(92 - dT * 2.6 - (otherCloser ? 25 : 0), {
        key: 'recover', want: { kind: 'take_dog', target: tofu.id }, x: tofu.x, z: tofu.z, sprint: true, timeout: 12,
        track: () => (tofu.hold.length ? { x: tofu.x + tofu.vx * 0.35, z: tofu.z + tofu.vz * 0.35 } : null),
      });
    }
    // 2. Dirty paws inside the house, or at the door before he comes in
    // (outside in winter, they get snowy again at once).
    const atDoor = tofu.pawKind !== 'snow' && tofu.mud > 0.4 && g.map.ai.entrances.some(([x, z]) => dist(tofu.x, tofu.z, x, z) < 3.5);
    if (tofu.mud > 0.25 && dT < 9 && (g.map.messy(tofu.x, tofu.z) || atDoor || (dT < 4 && tofu.pawKind !== 'snow'))) {
      add(70 - dT * 2, {
        key: 'paws', want: { kind: 'paws', target: tofu.id }, x: tofu.x, z: tofu.z, sprint: dT > 3, timeout: 8,
        track: () => (tofu.mud > 0.08 ? { x: tofu.x + tofu.vx * 0.3, z: tofu.z + tofu.vz * 0.3 } : null),
      });
    }
    // 3. Deliver what we hold.
    const deliver = this.deliverGoal();
    if (deliver) add(80, deliver);
    // 4. Messes.
    const cleanUrgency = S.cleanliness < S.cleanGoal + 8 ? 18 : 0;
    const allTasks = S.tasks.every((t) => t.done);
    for (const m of S.messes) {
      const d = dist(me.x, me.z, m.x, m.z);
      const dirt = MESS_TYPES[m.kind].dirt;
      // Water marks dry up by themselves: better spend the time elsewhere.
      const dries = m.kind === 'wet' ? 16 : 0;
      const player = this.playerOnIt(m.x, m.z) ? 22 : 0;
      add(48 + dirt * 1.5 - d * 1.1 + cleanUrgency + (allTasks ? 15 : 0) - dries - player, {
        key: `mess:${m.id}`, want: { kind: 'clean', target: m.id }, x: m.x, z: m.z, timeout: 18,
      });
    }
    // 4b. The robot vacuum: switch it off when Tofu started it or when it heads
    // for fragile things; switch it on when the floor is full of prints.
    const v = S.vacuum;
    const dv = dist(me.x, me.z, v.x, v.z);
    if (v.mode === 'run' && dv < 12 && (v.by === tofu.id || this.fragileNear(v.x, v.z, 2.5) > 0)) {
      add(64 - dv * 1.8, {
        key: 'vacuum-off', want: { kind: 'vacuum', target: 0 }, x: v.x, z: v.z, timeout: 8,
        track: () => (S.vacuum.mode === 'run' ? { x: S.vacuum.x, z: S.vacuum.z } : null),
      });
    } else if (v.mode === 'dock' && v.t <= 0 && dv < 14 && dist(tofu.x, tofu.z, v.x, v.z) > 5) {
      const dock = g.map.vacuum;
      let marks = 0;
      for (const m of S.messes) {
        if (isTrail(m.kind) && m.kind !== 'wet' && dist(m.x, m.z, dock.x, dock.z) < 5) marks += m.prints.length / 3;
      }
      if (marks >= 15 && this.fragileNear(dock.x, dock.z, 3) <= 1) {
        add(40 + Math.min(20, marks) - dv * 1.2, { key: 'vacuum-on', want: { kind: 'vacuum', target: 0 }, x: v.x, z: v.z, timeout: 10 });
      }
    }
    // 5. Jobs.
    if (!me.hold.length || g.canCarryAny(me)) {
      const objs = objectivesFor(g, me);
      const late = S.time > S.duration * 0.55 ? 8 : 0;
      for (const o of objs) {
        const d = dist(me.x, me.z, o.x, o.z);
        let goal: Goal | null = null;
        if (o.kind === 'item') {
          const it = S.items[o.target];
          if (it.state === 'held') continue; // carried by Tofu: handled by "recover"
          goal = { key: `item:${it.idx}`, want: this.itemWant(it), x: it.x, z: it.z, timeout: 25 };
        } else if (o.target >= 0) {
          const s = g.map.stations[o.target];
          const want = this.stationWant(o.target);
          if (!want) continue;
          goal = { key: `station:${o.target}`, want, x: s.x, z: s.z, timeout: 25 };
        } else {
          continue;
        }
        if (!goal.want) continue;
        add(56 - d * 0.9 + late - (this.playerOnIt(goal.x, goal.z) ? 20 : 0), goal);
      }
    }
    // 6. Return objects lying around (stolen and dropped by Tofu).
    if (g.canCarryAny(me)) {
      for (const it of S.items) {
        if (!it.disturbed || ITEM_TYPES[it.type].neverMess) continue;
        const inBasket = it.state === 'stored' && g.map.stations[it.station].kind === 'dog_basket';
        if (it.state !== 'free' && !inBasket) continue;
        if (!g.canCarry(me, it)) continue;
        const d = dist(me.x, me.z, it.x, it.z);
        add(44 - d * 1.0 + cleanUrgency * 0.5 - (this.playerOnIt(it.x, it.z) ? 20 : 0), { key: `item:${it.idx}`, want: this.itemWant(it), x: it.x, z: it.z, timeout: 20 });
      }
    }
    // 7. Treat refill at the nearest jar.
    if (me.treats === 0 && me.treatJarCd <= 0) {
      let si = -1;
      let bd = Infinity;
      g.map.stations.forEach((s, i) => {
        const d = dist(me.x, me.z, s.x, s.z);
        if (s.kind === 'treat_jar' && d < bd) {
          bd = d;
          si = i;
        }
      });
      if (si >= 0) {
        const s = g.map.stations[si];
        add(28 - bd * 0.5, { key: 'treats', want: { kind: 'treats', target: si }, x: s.x, z: s.z, timeout: 20 });
      }
    }
    // 7b. Protect finished jobs when Tofu sneaks toward them.
    for (const t of S.tasks) {
      if (!t.done) continue;
      const sid = protectStation(g, t.kind);
      if (!sid) continue;
      const s = g.map.stations[g.world.stationIndex.get(sid)!];
      const dTs = dist(tofu.x, tofu.z, s.x, s.z);
      if (dTs < 7 && !tofu.hold.length) {
        const dMe = dist(me.x, me.z, s.x, s.z);
        add(60 - dMe * 1.4, {
          key: `protect:${sid}`, want: null, x: s.x, z: s.z, sprint: dMe > 5, timeout: 6,
          track: () => ({ x: (s.x + tofu.x) / 2, z: (s.z + tofu.z) / 2 }),
        });
      }
    }
        // 8. Guard: stay between Tofu and the house when nothing else to do.
    // While the guests are coming, intercept Tofu near finished jobs.
    if (S.guestsT > 0 && dT < 16) {
      add(58 - dT * 1.5, {
        key: 'intercept', want: null, x: tofu.x, z: tofu.z, sprint: dT > 4, timeout: 5,
        track: () => ({ x: tofu.x + tofu.vx * 0.5, z: tofu.z + tofu.vz * 0.5 }),
      });
    }
    if (dT > 3) {
      add(12, {
        key: 'guard', want: null, x: tofu.x, z: tofu.z, timeout: 4,
        track: () => ({ x: tofu.x * 0.6 + me.x * 0.4, z: tofu.z * 0.6 + me.z * 0.4 }),
      });
    }
    if (!cands.length) return null;
    cands.sort((a, b) => b.u - a.u);
    // Small randomness to avoid robotic ties.
    const top = cands.filter((c) => c.u > cands[0].u - 3);
    return top[Math.floor(this.rng.next() * top.length)].goal;
  }

  private itemWant(it: Item): { kind: IKind; target: number } {
    return { kind: it.state === 'stored' ? 'take' : 'pickup', target: it.idx };
  }

  private stationWant(si: number): { kind: IKind; target: number } | null {
    const s = this.g.map.stations[si];
    if (this.g.restockable(si)) return { kind: 'buy', target: si };
    switch (s.kind) {
      case 'flowerbed':
        // A dug bed must be filled in first (its hole is a mess to clean).
        return this.g.state.stations[si].dug ? null : { kind: 'water', target: si };
      case 'tap':
        return { kind: 'fill', target: si };
      case 'bed':
        return { kind: 'bed', target: si };
      default:
        return { kind: 'store', target: si };
    }
  }

  /** Where should the held objects go? */
  private deliverGoal(): Goal | null {
    const g = this.g;
    const S = g.state;
    const me = this.me;
    if (!me.hold.length) return null;
    const it = S.items[me.hold[me.hold.length - 1]];
    const t = ITEM_TYPES[it.type];
    if (t.category === 'ball') return null; // kept to lure Tofu
    const chosen = new Set(S.tasks.map((x) => x.kind));
    let ids: string[] = [];
    let job = false;
    // A job object goes where the job wants it (picked this round, or set up
    // in its "done" place when the job was not picked).
    for (const kind of g.map.taskIds) {
      const spec = TASK_DEFS[kind].spec;
      if (spec.type === 'collect' && spec.items.includes(it.id)) ids = [spec.dest];
      else if (spec.type === 'deliver' && spec.item === it.id && (chosen.has(kind) || !spec.keep)) ids = [spec.dest];
      else if (spec.type === 'water' && spec.can === it.id) {
        // Watering can: water the beds, or refill.
        if (chosen.has(kind) && !S.tasks.find((x) => x.kind === kind)!.done) {
          ids = it.charge <= 0 ? [spec.tap] : spec.beds.filter((id) => {
            const st = g.stationById(id)!;
            return !st.watered || st.dug;
          });
        }
        job = true;
      } else continue;
      job = true;
      break;
    }
    if (!ids.length && t.category === 'tool') return { key: 'drop', want: { kind: 'drop', target: it.idx }, x: me.x, z: me.z, timeout: 3 };
    if (!job || !ids.length) {
      // Its usual places (a market stall takes back its own goods).
      ids = g.map.stations.filter((s) => (t.homes ?? []).includes(s.kind) || t.respawnAt === s.id).map((s) => s.id);
    }
    let best: Goal | null = null;
    let bd = Infinity;
    for (const id of ids) {
      const si = g.world.stationIndex.get(id)!;
      const s = g.map.stations[si];
      const want = this.stationWant(si);
      if (!want) continue;
      if (want.kind === 'store' && !g.accepts(si, it)) continue;
      // Places Tofu cannot reach (hamper with a lid) are worth a detour.
      const d = dist(me.x, me.z, s.x, s.z) + (s.dogReach && !job ? 8 : 0);
      if (d < bd) {
        bd = d;
        best = { key: `station:${si}`, want, x: s.x, z: s.z, timeout: 30 };
      }
    }
    if (best && g.canCarryAny(me) && (t.category === 'laundry' || t.category === 'toy')) {
      // Grab more pieces of the same job first if they are close by.
      for (const o of objectivesFor(g, me)) {
        if (o.kind !== 'item') continue;
        const other = S.items[o.target];
        if (other.state === 'held') continue;
        if (ITEM_TYPES[other.type].category !== t.category) continue;
        if (dist(me.x, me.z, other.x, other.z) < 4) {
          return { key: `item:${other.idx}`, want: this.itemWant(other), x: other.x, z: other.z, timeout: 10 };
        }
      }
    }
    return best;
  }

  /** Close a "protected" room door behind us when Tofu is not inside. */
  private doorToClose(): number {
    const g = this.g;
    const me = this.me;
    const tofu = g.tofu;
    if (me.hold.length && this.goal?.key.startsWith('station')) return -1;
    const doors = g.map.doors;
    for (let i = 0; i < doors.length; i++) {
      const d = doors[i];
      if (!g.state.doors[i].open || !protectedDoor(g, d.id)) continue;
      if (dist(me.x, me.z, d.x, d.z) > 1.3) continue;
      // Which side is the room? The room is the zone on the swing side.
      const nx = d.axis === 'x' ? 0 : d.swing;
      const nz = d.axis === 'x' ? d.swing : 0;
      const room = g.map.zoneAt(d.x + nx * 0.8, d.z + nz * 0.8);
      const meZone = g.map.zoneAt(me.x, me.z);
      const tofuZone = g.map.zoneAt(tofu.x, tofu.z);
      if (!room || meZone?.id === room.id || tofuZone?.id === room.id) continue;
      // Don't close it in front of ourselves if our goal is inside.
      const gz = this.goal ? g.map.zoneAt(this.goal.x, this.goal.z) : null;
      if (gz?.id === room.id) continue;
      if (this.rng.next() < 0.5) return i;
    }
    return -1;
  }

  setDt(dt: number) {
    this.dt = dt;
  }
}

export { HUMAN };
