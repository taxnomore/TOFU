// Authoritative game simulation. Runs identically in the browser (solo / local
// split screen) and on the Node LAN server. Fixed 60 Hz steps, deterministic
// for a given seed and input sequence.
import {
  BAGUETTE_RESPAWN, BTN_BARK, CAN, WET, CHAOS_GOAL_BY_HUMANS, BTN_INTERACT, BTN_SPECIAL, CHAOS, CHAOS_GOAL, CLEAN_GOAL,
  COUNTDOWN_TIME, DOG, GUARD_TIME, GUESTS_COUNTDOWN, HUMAN, KNOCK_RESTORE_CD, SIM_DT, ZOOM_GAIN, PAPER,
} from '../constants';
import { Rng, clamp, dist } from '../math';
import { ITEM_TYPES, MAKE_MESSES, MESS_TYPES, MessKind, isTrail } from '../world/itemTypes';
import type { GameMap } from '../world/mapTypes';
import { DEFAULT_MAP } from '../world/maps';
import { MASK_ITEM, Zone, makeDef } from '../world/types';
import { DEFAULT_VARIANT, Variant, presentIn } from '../world/variants';
import { catHearsBark, initialCat, updateCat } from './cat';
import { carrierHearsBark, initialCarrier, updateCarrier } from './carrier';
import { initialVacuum, updateVacuum } from './vacuum';
import { executeInteraction, listInteractions } from './interactions';
import { MoveContext, applyMovement, moveCharacter, resolveCircle, separateCharacters } from './movement';
import { TASK_DEFS, chooseSecrets, chooseTasks, computeCleanliness, evaluateTasks, secretInfo } from './rules';
import {
  Anim, Character, EMPTY_INPUT, GameConfig, GameEvent, GameState, InputFrame, Item, Mess, PlayerSlot,
  StationState, Stats, TaskKind, Winner,
} from './types';
import { World, getWorld } from './world';

const GRAVITY = 20;

function newStats(): Stats {
  return {
    laundryStolen: 0, itemsStolen: 0, knocks: 0, binsTipped: 0, mudPrints: 0, catChase: 0, barks: 0, eaten: 0,
    stashed: 0, messesCleaned: 0, recovered: 0, pawsWiped: 0, treatsThrown: 0, slips: 0, doorsClosed: 0, zoomies: 0,
    tofuDistance: 0, humanAccidents: 0, tasksDone: 0, startles: 0, paperUnrolled: 0,
    drops: 0, leavesScattered: 0, snowmen: 0, marketStolen: 0, chains: 0,
  };
}

function newCharacter(id: number, slot: PlayerSlot, x: number, z: number, facing: number): Character {
  return {
    id, role: slot.role, name: slot.name, avatar: slot.avatar, ai: slot.ai,
    x, z, vx: 0, vz: 0, facing, speed: 0, stamina: 1, sprinting: false, exhausted: false,
    hold: [], act: null, anim: Anim.Idle, animT: 0, lastButtons: 0, idleT: 0, lockT: 0,
    mud: 0, pawKind: 'mud', dripAcc: 0, zoom: 0, zoomT: 0, pantT: 0, barkCd: 0, sitT: 0, lureKind: '', lureIdx: -1, lureT: 0, lureImmune: 0,
    noPickup: 0, stun: 0, printAcc: 0, printSide: 1, paperAcc: 0, bedCd: 0, innocentDone: [], recentMischief: [],
    treats: HUMAN.treatsStart, throwCd: 0, treatJarCd: 0, slipCd: 0, startleCd: 0, takeCd: 0, say: '', sayT: 0,
  };
}

const HIDDEN_STORAGE = new Set(['hamper', 'dresser', 'toybox', 'mailbox', 'cupboard', 'street_bin']);

type TrailKind = 'mud' | 'paper' | 'wet' | 'leaf_trail';

/** Trail left indoors by each kind of dirty paws. */
const PAW_TRAIL: Record<Character['pawKind'], TrailKind> = { mud: 'mud', snow: 'wet', leaves: 'leaf_trail', wet: 'wet' };

export class Game {
  readonly world: World;
  readonly cfg: GameConfig;
  readonly variant: Variant;
  state: GameState;
  rng: Rng;
  readonly tofuId: number;
  private events: GameEvent[] = [];
  /** Mud and paper trails: one mess per 2 m cell ("kind:x,z" -> mess id). */
  private trailCells = new Map<string, number>();
  ctx: MoveContext;
  private chaosText = 0;

  constructor(cfg: GameConfig) {
    this.variant = cfg.variant ?? DEFAULT_VARIANT;
    this.world = getWorld(cfg.map ?? DEFAULT_MAP, this.variant);
    this.cfg = cfg;
    const { spawns, stations: STATIONS, items: ITEMS, doors: DOORS } = this.world.map;
    this.rng = new Rng(cfg.seed);
    const tofuIdx = cfg.players.findIndex((p) => p.role === 'tofu');
    if (tofuIdx < 0) throw new Error('A game needs exactly one Tofu');
    this.tofuId = tofuIdx;
    let h = 0;
    const chars = cfg.players.map((p, i) => {
      if (p.role === 'tofu') return newCharacter(i, p, spawns.tofu.x, spawns.tofu.z, spawns.tofu.facing);
      const s = spawns.humans[h++ % spawns.humans.length];
      return newCharacter(i, p, s.x, s.z, s.facing);
    });
    const humanCount = chars.filter((c) => c.role === 'human').length;
    // Stations of another ambiance (market stalls) stay closed.
    const stations: StationState[] = STATIONS.map((sd, idx) => ({
      idx, items: [], made: false, watered: false, dug: false, disabled: !presentIn(sd.only, this.variant), rev: 0,
    }));
    const items: Item[] = ITEMS.map((p, idx) => {
      const t = ITEM_TYPES[p.type];
      const st = p.station ? this.world.stationIndex.get(p.station)! : -1;
      const sd = st >= 0 ? STATIONS[st] : null;
      const x = p.x ?? sd!.x;
      const z = p.z ?? sd!.z;
      const y = p.y ?? (sd ? sd.y : 0);
      return {
        idx, id: p.id, type: p.type, state: st >= 0 ? 'stored' : t.knock ? 'home' : 'free',
        x, y, z, rot: p.rot ?? 0, tilt: 0, vx: 0, vy: 0, vz: 0, spin: 0, holder: -1, station: st, slot: -1, bounces: 0,
        disturbed: false, mess: -1, knockCd: 0, homeX: x, homeY: y, homeZ: z, homeRot: p.rot ?? 0, grabbedIn: '',
        lastStealT: -999, stashed: false, streetScored: false, charge: p.type === 'watering_can' ? 2 : p.type === 'toilet_roll' ? PAPER.length : 0, respawnT: 0, by: -1, guardT: 0, rev: 0,
      } as Item;
    });
    this.state = {
      phase: cfg.noCountdown ? 'play' : 'countdown',
      tick: 0, time: 0, duration: cfg.duration, countdown: cfg.countdown ?? COUNTDOWN_TIME,
      chaos: 0, chaosGoal: cfg.chaosGoal ?? this.map.chaosGoals?.[Math.min(2, Math.max(1, humanCount)) - 1] ?? CHAOS_GOAL_BY_HUMANS[Math.min(2, humanCount)] ?? CHAOS_GOAL, cleanliness: 100, cleanGoal: cfg.cleanGoal ?? CLEAN_GOAL,
      guestsT: 0, winner: null, endReason: '',
      chars, items, messes: [], stations,
      doors: DOORS.map((d, idx) => ({ idx, open: d.open, push: 0, rev: 0 })),
      treats: [], cat: null as never, carrier: initialCarrier(this.world.map), vacuum: initialVacuum(this.world.map),
      tasks: [], secrets: [], stats: newStats(), charStats: {}, nextMessId: 1, nextTreatId: 1, rngState: 0,
    };
    items.forEach((it, idx) => {
      // Objects of another ambiance (leaf piles, snowmen, market goods) are absent.
      if (!presentIn(ITEMS[idx].only, this.variant)) {
        it.state = 'gone';
        it.station = -1;
      }
    });
    for (const it of items) {
      if (it.station >= 0) this.putInStation(it, it.station);
    }
    this.ctx = { world: this.world, doors: this.state.doors, items: this.state.items };
    this.state.cat = initialCat(this);
    const kinds = chooseTasks(this.rng, humanCount, this.world.map);
    this.state.tasks = kinds.map((k) => ({ kind: k, done: false, progress: 0, total: 1 }));
    this.state.secrets = chooseSecrets(this.rng, humanCount, this.variant, this.world.map);
    this.prepareNonTaskState(new Set(kinds));
    for (const c of chars) this.state.charStats[c.id] = {};
    evaluateTasks(this);
    this.state.cleanliness = computeCleanliness(this);
    this.events.length = 0;
  }

  get map(): GameMap {
    return this.world.map;
  }

  /** Jobs not picked this round start in their "done" state (so Tofu can still undo them). */
  private prepareNonTaskState(kinds: Set<TaskKind>) {
    const moveTo = (itemId: string, stationId: string) => {
      const it = this.itemById(itemId)!;
      if (it.state === 'gone') return;
      if (it.station >= 0) this.removeFromStation(it);
      this.putInStation(it, this.world.stationIndex.get(stationId)!);
    };
    for (const kind of this.map.taskIds) {
      if (kinds.has(kind)) continue;
      const spec = TASK_DEFS[kind].spec;
      switch (spec.type) {
        case 'collect':
          // The first job is always picked: its objects stay where they are.
          for (const id of spec.items) moveTo(id, spec.dest);
          break;
        case 'deliver':
          if (!spec.keep) moveTo(spec.item, spec.dest);
          break;
        case 'make':
          this.stationById(spec.station)!.made = true;
          break;
        case 'water':
          for (const id of spec.beds) this.stationById(id)!.watered = true;
          break;
      }
    }
  }

  /** Replaces the state (network clients mirror the server state). */
  adoptState(S: GameState): void {
    this.state = S;
    this.ctx = { world: this.world, doors: S.doors, items: S.items };
  }

  get tofu(): Character {
    return this.state.chars[this.tofuId];
  }

  humans(): Character[] {
    return this.state.chars.filter((c) => c.role === 'human');
  }

  emit(e: GameEvent): void {
    this.events.push(e);
  }

  drainEvents(): GameEvent[] {
    const e = this.events;
    this.events = [];
    return e;
  }

  say(id: number, text: string): void {
    const c = this.state.chars[id];
    if (!c) return;
    c.say = text;
    c.sayT = 2.2;
    this.emit({ t: 'say', id, text });
  }

  itemById(id: string): Item | undefined {
    const i = this.world.itemIndex.get(id);
    return i === undefined ? undefined : this.state.items[i];
  }

  stationById(id: string): StationState | undefined {
    const i = this.world.stationIndex.get(id);
    return i === undefined ? undefined : this.state.stations[i];
  }

  private bump(it: { rev: number }) {
    it.rev++;
  }

  /** Marks a mess as changed (for network snapshots) after an outside edit. */
  touchMess(m: Mess): void {
    this.bump(m);
  }

  private stat(id: number, key: string, n = 1) {
    const s = this.state.charStats[id] ?? (this.state.charStats[id] = {});
    s[key] = (s[key] ?? 0) + n;
  }

  // ---------------------------------------------------------------------------
  // Main step
  // ---------------------------------------------------------------------------

  step(inputs: (InputFrame | undefined)[]): void {
    const S = this.state;
    const dt = SIM_DT;
    S.tick++;
    if (S.phase === 'countdown') {
      S.countdown -= dt;
      for (const c of S.chars) {
        c.lastButtons = (inputs[c.id] ?? EMPTY_INPUT).buttons;
        c.vx = c.vz = c.speed = 0;
        c.anim = c.role === 'tofu' ? Anim.Sit : Anim.Idle;
      }
      updateCat(this, dt);
      if (S.countdown <= 0) {
        S.phase = 'play';
        this.emit({ t: 'go' });
      }
      return;
    }
    if (S.phase === 'end') {
      for (const c of S.chars) {
        c.vx = c.vz = c.speed = 0;
        c.animT += dt;
        c.sayT = Math.max(0, c.sayT - dt);
      }
      updateCat(this, dt);
      return;
    }
    S.time += dt;
    for (const c of S.chars) this.updateChar(c, inputs[c.id] ?? EMPTY_INPUT, dt);
    separateCharacters(S.chars, this.ctx);
    for (const c of S.chars) this.postMove(c, dt);
    this.updateItems(dt);
    this.updateTreats(dt);
    updateCat(this, dt);
    updateCarrier(this, dt);
    updateVacuum(this, dt);
    this.updateMesses(dt);
    if (S.tick % 6 === 0) this.evaluate();
    if (S.guestsT > 0) {
      S.guestsT -= dt;
      if (S.guestsT <= 0 && S.phase === 'play') this.endGame('humans', 'guests');
    }
    if (S.phase === 'play' && S.chaos >= S.chaosGoal) this.endGame('tofu', 'chaos');
    if (S.phase === 'play' && S.time >= S.duration && S.guestsT <= 0) this.endGame('tofu', 'time');
  }

  private evaluate() {
    const S = this.state;
    evaluateTasks(this);
    S.cleanliness = computeCleanliness(this);
    const allDone = S.tasks.every((t) => t.done);
    const ok = allDone && S.cleanliness >= S.cleanGoal;
    if (ok && S.guestsT <= 0) {
      S.guestsT = GUESTS_COUNTDOWN;
      this.emit({ t: 'guests', on: true });
    } else if (!ok && S.guestsT > 0) {
      S.guestsT = 0;
      this.emit({ t: 'guests', on: false });
    }
  }

  endGame(winner: Winner, reason: string): void {
    const S = this.state;
    if (S.phase === 'end') return;
    S.phase = 'end';
    S.winner = winner;
    S.endReason = reason;
    S.guestsT = 0;
    for (const c of S.chars) {
      c.act = null;
      c.animT = 0;
      const won = (winner === 'tofu') === (c.role === 'tofu');
      c.anim = won ? Anim.Cheer : c.role === 'tofu' ? Anim.Sit : Anim.Sad;
    }
    this.emit({ t: 'end', winner, reason });
  }

  // ---------------------------------------------------------------------------
  // Characters
  // ---------------------------------------------------------------------------

  private updateChar(c: Character, inp: InputFrame, dt: number) {
    const pressed = inp.buttons & ~c.lastButtons;
    c.lastButtons = inp.buttons;
    c.animT += dt;
    c.barkCd = Math.max(0, c.barkCd - dt);
    c.noPickup = Math.max(0, c.noPickup - dt);
    c.lureImmune = Math.max(0, c.lureImmune - dt);
    c.throwCd = Math.max(0, c.throwCd - dt);
    c.treatJarCd = Math.max(0, c.treatJarCd - dt);
    c.slipCd = Math.max(0, c.slipCd - dt);
    c.startleCd = Math.max(0, c.startleCd - dt);
    c.takeCd = Math.max(0, c.takeCd - dt);
    c.bedCd = Math.max(0, c.bedCd - dt);
    c.lockT = Math.max(0, c.lockT - dt);
    c.sayT = Math.max(0, c.sayT - dt);
    c.pantT = Math.max(0, c.pantT - dt);
    if (c.zoomT > 0) {
      c.zoomT -= dt;
      if (c.zoomT <= 0) {
        c.zoomT = 0;
        c.pantT = DOG.pantTime;
        this.emit({ t: 'zoomies', id: c.id, on: false });
      }
    }
    const isDog = c.role === 'tofu';

    if (c.stun > 0) {
      c.stun -= dt;
      c.act = null;
      moveCharacter(c, 0, 0, 0, dt, this.ctx, false);
      return;
    }
    if (isDog && c.lureKind) {
      this.updateLure(c, dt);
      return;
    }

    // Interaction (instant or hold).
    if (pressed & BTN_INTERACT) {
      const list = listInteractions(this, c);
      const pk = inp.pick;
      const inter = (pk && list.find((l) => l.kind === pk.kind && l.target === pk.target)) || list[0];
      if (inter) {
        if (inter.hold <= 0) executeInteraction(this, c, inter);
        else c.act = { kind: inter.kind, target: inter.target, t: 0, dur: inter.hold };
      }
    }
    if (c.act) {
      const a = c.act;
      if (!(inp.buttons & BTN_INTERACT)) {
        c.act = null;
      } else {
        const list = listInteractions(this, c);
        const inter = list.find((l) => l.kind === a.kind && l.target === a.target);
        if (!inter) {
          c.act = null;
        } else if (a.kind === 'clean') {
          const m = this.messById(a.target);
          if (!m) c.act = null;
          else {
            m.progress += dt;
            a.t = m.progress;
            a.dur = MESS_TYPES[m.kind].clean;
            this.bump(m);
            if (m.progress >= a.dur) {
              executeInteraction(this, c, inter);
              c.act = null;
            }
          }
        } else {
          a.t += dt;
          if (a.t >= a.dur) {
            executeInteraction(this, c, inter);
            c.act = null;
          }
        }
      }
    }

    // Special and bark buttons.
    if (pressed & BTN_SPECIAL) {
      if (isDog) this.startZoomies(c);
      else this.humanSpecial(c);
    }
    if (pressed & BTN_BARK) {
      if (isDog) this.bark(c);
      else if (c.barkCd <= 0) {
        c.barkCd = 2.5;
        this.say(c.id, this.rng.pick(['Tofu ! Au pied !', 'Tofu, non !', 'Tofu ! Lâche ça !', 'Tofuuu !']));
      }
    }

    // Movement (shared with client-side prediction).
    const sitting = applyMovement(c, inp, dt, this.ctx);
    this.pickAnim(c, sitting);
  }

  private pickAnim(c: Character, sitting: boolean) {
    const prev = c.anim;
    let a: Anim;
    if (c.lockT > 0 && (prev === Anim.Bark || prev === Anim.Throw || prev === Anim.Eat || prev === Anim.Jump || prev === Anim.Pet || prev === Anim.Interact)) {
      return;
    }
    if (c.act) {
      const k = c.act.kind;
      a = k === 'clean' || k === 'bed' || k === 'water' || k === 'fill' ? Anim.Clean
        : k === 'push_door' || k === 'push_bin' || k === 'tablecloth' ? Anim.Push
          : k === 'dig' ? Anim.Dig : k === 'eat' ? Anim.Eat : Anim.Interact;
    } else if (c.speed > 0.35) {
      a = c.role === 'tofu' ? (c.speed > DOG.walk + 0.3 ? Anim.Run : Anim.Walk) : c.speed > 4.3 ? Anim.Run : Anim.Walk;
    } else if (sitting) {
      a = Anim.Sit;
    } else {
      a = Anim.Idle;
    }
    if (a !== prev) {
      c.anim = a;
      c.animT = 0;
    }
  }

  private oneShot(c: Character, a: Anim, t: number) {
    c.anim = a;
    c.animT = 0;
    c.lockT = t;
  }

  private postMove(c: Character, dt: number) {
    const S = this.state;
    if (c.role === 'tofu') {
      S.stats.tofuDistance += c.speed * dt;
      // Puddles make Tofu muddy.
      for (const p of this.map.puddles) {
        if (dist(c.x, c.z, p.x, p.z) < p.r) {
          const kind = p.kind === 'water' ? 'wet' : 'mud';
          if (c.mud < 0.5 || c.pawKind !== kind) {
            this.emit({ t: 'muddy', id: c.id, kind });
            this.addZoom(c, 'mud');
          }
          c.mud = 1;
          c.pawKind = kind;
        }
      }
      const zn = this.map.zoneAt(c.x, c.z);
      // Winter: the snow wets the paws everywhere outside (the street is cleared).
      if (this.variant === 'hiver' && zn && this.map.snowyZones.includes(zn.id) && c.mud <= DOG.snowPaws) {
        c.mud = DOG.snowPaws;
        c.pawKind = 'snow';
      }
      if (c.mud > 0.02 && c.speed > 0.3) {
        if (zn && (zn.indoor || zn.prints)) {
          c.printAcc += c.speed * dt;
          if (c.printAcc >= DOG.printSpacing) {
            c.printAcc = 0;
            this.addMudPrint(c, zn.id);
          }
        } else {
          c.mud = Math.max(0, c.mud - DOG.mudDecayOutdoor * dt);
        }
      }
      // The stolen watering can leaks behind Tofu.
      const can = c.hold.map((i) => S.items[i]).find((it) => it.type === 'watering_can' && it.charge > 0);
      if (can && c.speed > 0.5) {
        c.dripAcc += c.speed * dt;
        if (c.dripAcc >= CAN.dripSpacing) {
          c.dripAcc = 0;
          this.addDrip(c, can, zn);
        }
      }
      // A carried toilet roll unrolls behind Tofu.
      const roll = c.hold.map((i) => S.items[i]).find((it) => it.type === 'toilet_roll' && it.charge > 0);
      if (roll && c.speed > 0.5) {
        c.paperAcc += c.speed * dt;
        if (c.paperAcc >= PAPER.spacing) {
          c.paperAcc = 0;
          this.addPaperStrip(c, roll, zn ? zn.id : '');
        }
      }
      // Bumps knock things over.
      for (const it of S.items) {
        if (it.state !== 'home' || it.knockCd > 0 || it.y > 0.1) continue;
        const t = ITEM_TYPES[it.type];
        if (!t.knock) continue;
        const dd = dist(c.x, c.z, it.x, it.z);
        if (dd > DOG.radius + t.size + 0.1) continue;
        const toX = (it.x - c.x) / (dd || 1);
        const toZ = (it.z - c.z) / (dd || 1);
        const approach = c.vx * toX + c.vz * toZ;
        const fast = c.zoomT > 0 || c.speed >= t.knock.minSpeed;
        if (fast && (approach > 0.3 || c.zoomT > 0)) {
          const dl = Math.hypot(c.vx, c.vz) || 1;
          this.knock(it.idx, c.vx / dl, c.vz / dl, c.speed, c.id);
        }
      }
      // Innocent sitting next to a mess.
      if (c.sitT >= DOG.innocentTime) {
        for (const m of S.messes) {
          if (!m.byTofu || c.innocentDone.includes(m.id)) continue;
          if (dist(c.x, c.z, m.x, m.z) < m.r + 2.5) {
            c.innocentDone.push(m.id);
            this.emit({ t: 'innocent', id: c.id });
            this.addChaos(CHAOS.innocent, "L'air innocent…", c.x, c.z);
            this.progressSecret('innocent', 1);
            break;
          }
        }
      }
    } else {
      // Clumsy sprinting humans.
      if (c.speed > HUMAN.clumsySpeed) {
        for (const it of S.items) {
          if (it.state !== 'home' || it.knockCd > 0 || it.y > 0.1) continue;
          const t = ITEM_TYPES[it.type];
          if (!t.knock || t.knock.push > 0) continue;
          const dd = dist(c.x, c.z, it.x, it.z);
          if (dd > HUMAN.radius + t.size + 0.12) continue;
          const dl = Math.hypot(c.vx, c.vz) || 1;
          if ((c.vx * (it.x - c.x) + c.vz * (it.z - c.z)) / (dd || 1) > 0.3) {
            this.knock(it.idx, c.vx / dl, c.vz / dl, c.speed, c.id);
          }
        }
        if (c.slipCd <= 0) {
          let slip = false;
          for (const m of S.messes) {
            if (!MESS_TYPES[m.kind].slippery) continue;
            if (isTrail(m.kind) && m.prints.length < 9) continue;
            if (dist(c.x, c.z, m.x, m.z) < m.r * 0.8) slip = true;
          }
          for (const it of S.items) {
            if (it.state !== 'free') continue;
            const cat = ITEM_TYPES[it.type].category;
            if (cat !== 'ball' && cat !== 'toy') continue;
            if (dist(c.x, c.z, it.x, it.z) < 0.38) slip = true;
          }
          if (slip) this.slip(c);
        }
      }
    }
  }

  slip(c: Character): void {
    const S = this.state;
    c.stun = HUMAN.slipTime;
    c.slipCd = HUMAN.slipCd;
    c.act = null;
    c.anim = Anim.Slip;
    c.animT = 0;
    S.stats.slips++;
    this.stat(c.id, 'slips');
    // Drop everything held, scattering it a little.
    const held = [...c.hold];
    c.hold.length = 0;
    held.forEach((i, k) => {
      const it = S.items[i];
      it.holder = -1;
      it.state = 'air';
      const a = c.facing + (k - 1) * 0.9;
      it.x = c.x;
      it.z = c.z;
      it.y = 1.0;
      it.vx = Math.sin(a) * 2.2 + c.vx * 0.3;
      it.vz = Math.cos(a) * 2.2 + c.vz * 0.3;
      it.vy = 3;
      it.spin = 8;
      it.bounces = 0;
      it.by = c.id;
      this.bump(it);
    });
    this.say(c.id, 'Oups !');
    this.emit({ t: 'slip', id: c.id });
    this.addChaos(CHAOS.humanSlip, 'Patatras !', c.x, c.z);
  }

  // ---------------------------------------------------------------------------
  // Dog abilities
  // ---------------------------------------------------------------------------

  bark(c: Character): void {
    if (c.barkCd > 0) return;
    c.barkCd = DOG.barkCd;
    this.oneShot(c, Anim.Bark, 0.35);
    this.state.stats.barks++;
    this.emit({ t: 'bark', id: c.id });
    for (const h of this.humans()) {
      if (dist(h.x, h.z, c.x, c.z) > 4.5) continue;
      if (h.act && h.startleCd <= 0) {
        h.startleCd = 4;
        if (h.act.kind === 'clean') {
          const m = this.messById(h.act.target);
          if (m) m.progress *= 0.55;
        }
        h.act.t *= 0.4;
        h.act = null;
        this.say(h.id, 'Aaah !');
        this.emit({ t: 'startle', id: h.id, by: c.id });
        this.state.stats.startles++;
        this.progressSecret('aboie', 1);
      }
    }
    catHearsBark(this);
    carrierHearsBark(this);
  }

  startZoomies(c: Character): void {
    if (c.zoom < 1 || c.zoomT > 0) return;
    c.zoom = 0;
    c.zoomT = DOG.zoomiesTime;
    c.act = null;
    this.state.stats.zoomies++;
    this.emit({ t: 'zoomies', id: c.id, on: true });
    if (this.map.messy(c.x, c.z)) this.progressSecret('zoomies', 1);
  }

  addZoom(c: Character, type: string): void {
    if (c.role !== 'tofu' || c.zoomT > 0) return;
    const base = ZOOM_GAIN[type] ?? 0.1;
    const repeats = c.recentMischief.filter((m) => m === type).length;
    const gain = base * Math.max(0.3, 1 - repeats * 0.3);
    c.zoom = Math.min(1, c.zoom + gain);
    c.recentMischief.push(type);
    if (c.recentMischief.length > 4) c.recentMischief.shift();
  }

  private startLure(kind: 'treat' | 'ball', idx: number) {
    const c = this.tofu;
    if (c.hold.length) this.dropHeld(c, true);
    c.act = null;
    if (c.zoomT > 0) {
      c.zoomT = 0;
      this.emit({ t: 'zoomies', id: c.id, on: false });
    }
    c.lureKind = kind;
    c.lureIdx = idx;
    c.lureT = 0;
    c.sitT = 0;
    this.say(c.id, kind === 'treat' ? 'Miam ?!' : 'La baballe !');
    this.emit({ t: 'lured', id: c.id, kind });
  }

  private endLure(c: Character) {
    c.lureKind = '';
    c.lureIdx = -1;
    c.lureImmune = DOG.lureImmunity;
  }

  private updateLure(c: Character, dt: number) {
    const S = this.state;
    c.lureT += dt;
    let tx = 0;
    let tz = 0;
    let ok = false;
    if (c.lureKind === 'treat') {
      const t = S.treats.find((tr) => tr.id === c.lureIdx);
      if (t) {
        tx = t.x;
        tz = t.z;
        ok = true;
      }
    } else {
      const b = S.items[c.lureIdx];
      if (b && (b.state === 'free' || b.state === 'air')) {
        tx = b.x;
        tz = b.z;
        ok = true;
      }
    }
    if (!ok || c.lureT > DOG.lureMaxTime) {
      this.endLure(c);
      return;
    }
    const d = dist(c.x, c.z, tx, tz);
    if (d < 0.55) {
      if (c.lureKind === 'treat') {
        S.treats = S.treats.filter((tr) => tr.id !== c.lureIdx);
        this.oneShot(c, Anim.Eat, 0.9);
        c.zoom = Math.min(1, c.zoom + 0.12);
        this.emit({ t: 'eat', id: c.id, item: -1 });
      } else {
        const b = S.items[c.lureIdx];
        if (b.state === 'air') {
          b.state = 'free';
          b.vx = b.vy = b.vz = 0;
          b.y = 0;
        }
        this.grab(c, b);
      }
      this.endLure(c);
      return;
    }
    moveCharacter(c, (tx - c.x) / d, (tz - c.z) / d, DOG.walk * 1.15, dt, this.ctx);
    this.pickAnim(c, false);
  }

  // ---------------------------------------------------------------------------
  // Human abilities
  // ---------------------------------------------------------------------------

  private humanSpecial(c: Character) {
    const S = this.state;
    const ballIdx = c.hold.find((i) => S.items[i].type === 'ball');
    if (ballIdx !== undefined) {
      this.throwBall(c, ballIdx);
      return;
    }
    if (c.treats > 0 && c.throwCd <= 0) this.throwTreat(c);
  }

  private throwTreat(c: Character) {
    const S = this.state;
    const fx = Math.sin(c.facing);
    const fz = Math.cos(c.facing);
    S.treats.push({
      id: S.nextTreatId++, owner: c.id, x: c.x + fx * 0.3, y: 1.2, z: c.z + fz * 0.3,
      vx: fx * 5.2 + c.vx * 0.3, vy: 2.6, vz: fz * 5.2 + c.vz * 0.3, landed: false, landT: 0,
    });
    // Keep at most 3 treats per human on the ground.
    const mine = S.treats.filter((t) => t.owner === c.id);
    if (mine.length > 3) S.treats = S.treats.filter((t) => t !== mine[0]);
    c.treats--;
    c.throwCd = HUMAN.treatThrowCd;
    this.oneShot(c, Anim.Throw, 0.4);
    S.stats.treatsThrown++;
    this.stat(c.id, 'treats');
    this.emit({ t: 'treat', by: c.id, x: c.x, z: c.z });
  }

  private throwBall(c: Character, idx: number) {
    const it = this.state.items[idx];
    c.hold = c.hold.filter((i) => i !== idx);
    const fx = Math.sin(c.facing);
    const fz = Math.cos(c.facing);
    it.holder = -1;
    it.state = 'air';
    it.x = c.x + fx * 0.4;
    it.z = c.z + fz * 0.4;
    it.y = 1.4;
    it.vx = fx * 8.5;
    it.vz = fz * 8.5;
    it.vy = 4.2;
    it.spin = 10;
    it.bounces = 0;
    it.by = c.id;
    this.bump(it);
    this.oneShot(c, Anim.Throw, 0.4);
    this.emit({ t: 'throw', id: c.id, item: idx });
  }

  // ---------------------------------------------------------------------------
  // Items
  // ---------------------------------------------------------------------------

  private updateItems(dt: number) {
    const S = this.state;
    for (const it of S.items) {
      if (it.knockCd > 0) it.knockCd = Math.max(0, it.knockCd - dt);
      if (it.guardT > 0) {
        it.guardT = Math.max(0, it.guardT - dt);
        if (it.guardT === 0) this.bump(it); // clients hide Tofu's prompt while guarded
      }
      if (it.state === 'held') {
        const h = S.chars[it.holder];
        if (h) {
          const fx = Math.sin(h.facing);
          const fz = Math.cos(h.facing);
          const off = h.role === 'tofu' ? 0.5 : 0.35;
          it.x = h.x + fx * off;
          it.z = h.z + fz * off;
          it.y = h.role === 'tofu' ? 0.45 : 1.0;
          it.rot = h.facing;
        }
      } else if (it.state === 'air') {
        this.updateAir(it, dt);
      } else if (it.state === 'gone' && it.respawnT > 0) {
        it.respawnT -= dt;
        if (it.respawnT <= 0) {
          it.respawnT = 0;
          const home = this.world.stationIndex.get(ITEM_TYPES[it.type].respawnAt ?? '');
          it.disturbed = false;
          if (home !== undefined) this.putInStation(it, home);
        }
      }
    }
  }

  private updateAir(it: Item, dt: number) {
    const onGround = it.y <= 0.001 && it.vy <= 0;
    if (!onGround) it.vy -= GRAVITY * dt;
    const r = 0.14;
    // Horizontal move with height-aware collisions (furniture is low, walls are tall).
    const nx = it.x + it.vx * dt;
    const nz = it.z + it.vz * dt;
    const blocked = (x: number, z: number) => {
      let hit = false;
      this.world.cols.query(x - r, z - r, x + r, z + r, (b) => {
        if (hit || !(b.mask & MASK_ITEM)) return;
        if (b.tag.startsWith('prop:') && it.y > b.h) return;
        const cx = clamp(x, b.x0, b.x1);
        const cz = clamp(z, b.z0, b.z1);
        if ((x - cx) ** 2 + (z - cz) ** 2 < r * r) hit = true;
      }, (c) => {
        if (hit || !(c.mask & MASK_ITEM)) return;
        if (it.y > c.h) return;
        if ((x - c.x) ** 2 + (z - c.z) ** 2 < (r + c.r) ** 2) hit = true;
      });
      if (!hit) {
        for (let i = 0; i < this.state.doors.length; i++) {
          if (this.state.doors[i].open) continue;
          const b = this.world.doorBoxes[i];
          const cx = clamp(x, b.x0, b.x1);
          const cz = clamp(z, b.z0, b.z1);
          if ((x - cx) ** 2 + (z - cz) ** 2 < r * r) hit = true;
        }
      }
      return hit;
    };
    if (!blocked(nx, it.z)) it.x = nx;
    else it.vx *= -0.3;
    if (!blocked(it.x, nz)) it.z = nz;
    else it.vz *= -0.3;
    const B = this.map.bounds;
    it.x = clamp(it.x, B.x0 + 0.5, B.x1 - 0.5);
    it.z = clamp(it.z, B.z0 + 0.5, B.z1 - 0.5);
    if (it.type === 'ball' && it.by >= 0) this.ballHits(it);
    it.y += it.vy * dt;
    it.rot += it.spin * dt;
    this.bump(it);
    if (it.y <= 0) {
      it.y = 0;
      const isBall = it.type === 'ball';
      if (it.vy < -2.5 && it.bounces < (isBall ? 3 : 1)) {
        it.vy = -it.vy * (isBall ? 0.55 : 0.3);
        it.vx *= 0.65;
        it.vz *= 0.65;
        it.bounces++;
        it.spin *= 0.5;
        this.emit({ t: 'land', item: it.idx, x: it.x, z: it.z, hard: false });
        return;
      }
      it.vy = 0;
      if (isBall) {
        // Roll with friction.
        const sp = Math.hypot(it.vx, it.vz);
        const ns = Math.max(0, sp - 4 * dt);
        if (ns > 0.15) {
          it.vx *= ns / sp;
          it.vz *= ns / sp;
          this.checkBallLure(it);
          return;
        }
      }
      this.landItem(it);
    }
  }

  /** A thrown ball knocks over what it hits on its way (a clumsy throw: a human accident). */
  private ballHits(ball: Item) {
    const sp = Math.hypot(ball.vx, ball.vz);
    if (sp < 2) return;
    for (const k of this.state.items) {
      if (k === ball || k.state !== 'home' || k.knockCd > 0) continue;
      const t = ITEM_TYPES[k.type];
      if (!t.knock || t.knock.push > 0) continue;
      if (ball.y < k.y - 0.05 || ball.y > k.y + t.knock.height + 0.1) continue;
      if (dist(ball.x, ball.z, k.x, k.z) > t.size + 0.12) continue;
      this.knock(k.idx, ball.vx / sp, ball.vz / sp, sp * 0.5, ball.by);
      ball.vx *= -0.35;
      ball.vz *= -0.35;
      return;
    }
  }

  private checkBallLure(ball: Item) {
    const tofu = this.tofu;
    if (ball.by < 0 || this.state.chars[ball.by]?.role !== 'human') return;
    if (tofu.lureKind || tofu.lureImmune > 0 || tofu.stun > 0) return;
    if (dist(tofu.x, tofu.z, ball.x, ball.z) < DOG.lureBallRange) {
      ball.by = -1;
      this.startLure('ball', ball.idx);
    }
  }

  private landItem(it: Item) {
    const t = ITEM_TYPES[it.type];
    it.vx = it.vy = it.vz = 0;
    it.spin = 0;
    it.y = 0;
    this.placeItemSafely(it, it.x, it.z);
    if (t.knock) {
      it.state = 'knocked';
      it.tilt = t.knock.lie === 'flat' ? 0 : Math.PI / 2;
      const byTofu = it.by === this.tofuId;
      const m = this.createMess(t.knock.mess, it.x, it.z, { item: it.idx, byTofu: byTofu || it.by === -2 || it.by === -4 });
      it.mess = m.id;
      this.emit({ t: 'land', item: it.idx, x: it.x, z: it.z, hard: true });
    } else {
      it.state = 'free';
      it.tilt = 0;
      this.emit({ t: 'land', item: it.idx, x: it.x, z: it.z, hard: false });
      if (it.type === 'ball') this.checkBallLure(it);
    }
    this.bump(it);
  }

  /** Puts an item at (x,z) outside of furniture and within reach of human players. */
  placeItemSafely(it: Item, x: number, z: number): void {
    const p = { x, z };
    resolveCircle(this.ctx, p, 0.12, MASK_ITEM);
    const nav = this.world.humanNav;
    // Reachable if a free human cell lies within ~1 m.
    let reachable = false;
    for (let dz = -1; dz <= 1 && !reachable; dz += 0.5) {
      for (let dx = -1; dx <= 1 && !reachable; dx += 0.5) {
        if (dx * dx + dz * dz > 1.01) continue;
        const i = nav.cellOf(p.x + dx, p.z + dz);
        if (i >= 0 && !nav.blocked[i] && nav.comp[i] === this.mainComp()) reachable = true;
      }
    }
    if (!reachable) {
      const q = nav.nearestFree(p.x, p.z, 8, this.mainComp());
      if (q) {
        p.x = q.x;
        p.z = q.z;
      }
    }
    it.x = p.x;
    it.z = p.z;
  }

  private mainCompId = -2;
  private mainComp(): number {
    if (this.mainCompId === -2) {
      const nav = this.world.humanNav;
      const sp = this.map.spawns.humans[0];
      this.mainCompId = nav.comp[nav.cellOf(sp.x, sp.z)];
    }
    return this.mainCompId;
  }

  knock(idx: number, dx: number, dz: number, power: number, by: number): boolean {
    const S = this.state;
    const it = S.items[idx];
    if (!it || it.state !== 'home' || it.knockCd > 0) return false;
    const t = ITEM_TYPES[it.type];
    if (!t.knock) return false;
    const p = Math.min(power, 9);
    it.state = 'air';
    it.vx = dx * (0.8 + p * 0.25);
    it.vz = dz * (0.8 + p * 0.25);
    it.vy = 1.6 + t.knock.height * 1.2;
    it.y = Math.max(it.y, 0.05);
    it.spin = (this.rng.next() < 0.5 ? -1 : 1) * (5 + this.rng.next() * 4);
    it.bounces = 0;
    it.by = by;
    this.bump(it);
    S.stats.knocks++;
    const isBin = it.type.includes('bin');
    if (isBin) S.stats.binsTipped++;
    // A bin that is also a station spills its content.
    const stIdx = this.map.stations.findIndex((s) => s.linkedItem === it.id);
    if (stIdx >= 0) {
      const st = S.stations[stIdx];
      st.disabled = true;
      this.bump(st);
      for (const i of [...st.items]) {
        const content = S.items[i];
        this.removeFromStation(content);
        content.state = 'air';
        content.y = 0.8;
        content.vx = dx * 2 + (this.rng.next() - 0.5) * 2;
        content.vz = dz * 2 + (this.rng.next() - 0.5) * 2;
        content.vy = 2;
        content.bounces = 0;
        content.by = by;
        this.bump(content);
      }
    }
    let amount = t.knock.chaos;
    let reason = t.knock.text ?? `${capitalize(t.short)} renversé${feminine(t.name) ? 'e' : ''} !`;
    if (it.type === 'leaf_pile') S.stats.leavesScattered++;
    if (by === this.tofuId) {
      this.addZoom(this.tofu, isBin ? 'bin' : it.type === 'leaf_pile' ? 'leaves' : 'knock');
      this.progressSecret('casse', 1);
      if (isBin) this.progressSecret('poubelles', 1);
      this.onTofuKnock(it);
    } else if (by === -2 || by === -4) {
      // The cat or the robot vacuum. Chased by Tofu, or switched on by him: a
      // chain reaction, worth full points.
      const chain = by === -2
        ? S.cat.mode === 'flee' && dist(S.cat.x, S.cat.z, this.tofu.x, this.tofu.z) < 9
        : S.vacuum.by === this.tofuId;
      if (chain) {
        reason = by === -2 ? 'Réaction en chaîne : le chat a tout renversé !' : "Réaction en chaîne : l'aspirateur a tout renversé !";
        S.stats.chains++;
        this.addZoom(this.tofu, 'knock');
        this.progressSecret('chaine', 1);
        this.progressSecret('casse', 1);
      } else {
        amount *= CHAOS.catAccidentMul;
        reason = by === -2 ? 'Le chat a tout renversé !' : "L'aspirateur a tout renversé !";
      }
    } else {
      amount *= CHAOS.accidentMul;
      reason = 'Oups ! Accident humain !';
      S.stats.humanAccidents++;
      this.say(by, 'Oups !');
    }
    this.addChaos(amount, reason, it.x, it.z);
    this.emit({ t: 'knock', item: idx, by, x: it.x, z: it.z });
    return true;
  }

  /** Seasonal mischief done on purpose by Tofu. */
  private onTofuKnock(it: Item) {
    const c = this.tofu;
    if (it.type === 'leaf_pile') {
      // Leaves stuck in the fur: he brings them inside.
      if (c.mud <= DOG.leafPaws || c.pawKind !== 'mud') {
        c.mud = Math.max(c.mud, DOG.leafPaws);
        c.pawKind = 'leaves';
      }
      this.progressSecret('feuilles', 1);
    } else if (it.type === 'snowman') {
      this.state.stats.snowmen++;
      this.progressSecret('bonhomme', 1);
    }
  }

  // ---------------------------------------------------------------------------
  // Stations & carrying
  // ---------------------------------------------------------------------------

  slotPos(si: number, slot: number): { x: number; y: number; z: number } {
    const s = this.map.stations[si];
    if (s.slots && slot >= 0 && slot < s.slots.length) {
      const [ox, oy, oz] = s.slots[slot];
      return { x: s.x + ox, y: oy, z: s.z + oz };
    }
    if (slot <= 0) return { x: s.x, y: s.y, z: s.z };
    const a = slot * 2.1;
    return { x: s.x + Math.cos(a) * 0.16, y: s.y, z: s.z + Math.sin(a) * 0.16 };
  }

  putInStation(it: Item, si: number): void {
    const st = this.state.stations[si];
    const used = new Set(st.items.map((i) => this.state.items[i].slot));
    let slot = 0;
    while (used.has(slot)) slot++;
    st.items.push(it.idx);
    it.state = 'stored';
    it.station = si;
    it.slot = slot;
    it.holder = -1;
    const p = this.slotPos(si, slot);
    it.x = p.x;
    it.y = p.y;
    it.z = p.z;
    it.tilt = 0;
    // A roll put back on its holder is a fresh one.
    if (this.map.stations[si].kind === 'roll_holder') it.charge = PAPER.length;
    this.bump(it);
    this.bump(st);
  }

  removeFromStation(it: Item): void {
    if (it.station < 0) return;
    const st = this.state.stations[it.station];
    st.items = st.items.filter((i) => i !== it.idx);
    this.bump(st);
    it.station = -1;
    it.slot = -1;
  }

  isHiddenStorage(si: number): boolean {
    return HIDDEN_STORAGE.has(this.map.stations[si].kind);
  }

  canCarry(c: Character, it: Item): boolean {
    const t = ITEM_TYPES[it.type];
    if (!t.carry) return false;
    if (c.role === 'tofu') return t.carry.dog && c.hold.length === 0;
    if (!t.carry.human) return false;
    if (c.hold.length === 0) return true;
    if (t.carry.stack <= 1) return false;
    for (const i of c.hold) {
      const ht = ITEM_TYPES[this.state.items[i].type];
      if ((ht.carry?.stack ?? 1) <= 1) return false;
    }
    return c.hold.length < HUMAN.carryMax;
  }

  /** True if the character has room for at least one more object. */
  canCarryAny(c: Character): boolean {
    if (c.role === 'tofu') return c.hold.length === 0;
    if (c.hold.length === 0) return true;
    if (c.hold.length >= HUMAN.carryMax) return false;
    return c.hold.every((i) => (ITEM_TYPES[this.state.items[i].type].carry?.stack ?? 1) > 1);
  }

  /** Can this item be stored at the station by a human? */
  accepts(si: number, it: Item): boolean {
    const s = this.map.stations[si];
    const st = this.state.stations[si];
    if (st.disabled) return false;
    if (st.items.length >= (s.capacity ?? 4)) return false;
    const cat = ITEM_TYPES[it.type].category;
    switch (s.kind) {
      case 'hamper':
      case 'dresser':
        return cat === 'laundry';
      case 'toybox':
        return cat === 'toy';
      case 'dining_table':
        return it.type === 'dishes';
      case 'cupboard':
        return it.type === 'dishes';
      case 'garden_table':
      case 'counter':
        return cat === 'food';
      case 'console':
        return cat === 'paper';
      case 'roll_holder':
        return it.type === 'toilet_roll';
      case 'street_bin':
        return cat === 'trash';
      case 'bakery':
        return it.type === 'baguette';
      case 'shoe_rack':
      case 'bedside':
        return it.type === 'slipper';
      case 'market':
        // Each stall takes back its own goods.
        return ITEM_TYPES[it.type].respawnAt === s.id;
      default:
        // Newer stations: the objects that live there.
        return (ITEM_TYPES[it.type].homes ?? []).includes(s.kind);
    }
  }

  private grab(c: Character, it: Item) {
    if (it.station >= 0) this.removeFromStation(it);
    it.state = 'held';
    it.holder = c.id;
    it.tilt = 0;
    it.vx = it.vy = it.vz = 0;
    c.hold.push(it.idx);
    this.bump(it);
    if (c.role === 'tofu') this.onDogGrab(c, it);
    this.emit({ t: 'pickup', id: c.id, item: it.idx });
  }

  private onDogGrab(c: Character, it: Item) {
    const S = this.state;
    const t = ITEM_TYPES[it.type];
    if (t.category === 'ball') return;
    it.disturbed = true;
    it.grabbedIn = this.map.zoneAt(it.x, it.z)?.id ?? '';
    if (S.time - it.lastStealT > CHAOS.stealRepeatWindow) {
      S.stats.itemsStolen++;
      if (t.category === 'laundry') {
        S.stats.laundryStolen++;
        this.progressSecret('voleur', 1);
      }
      if (t.category === 'market') {
        S.stats.marketStolen++;
        this.addChaos(CHAOS.marketSteal, `Vol au marché : ${t.short} !`, it.x, it.z);
      } else {
        this.addChaos(CHAOS.steal, `${capitalize(t.short)} volé${feminine(t.name) ? 'e' : ''} !`, it.x, it.z);
      }
      this.addZoom(c, 'steal');
      this.emit({ t: 'steal', id: c.id, item: it.idx, x: it.x, z: it.z });
    }
    it.lastStealT = S.time;
  }

  pickup(c: Character, idx: number): void {
    const it = this.state.items[idx];
    if (it.state !== 'free' || !this.canCarry(c, it)) return;
    this.grab(c, it);
    this.oneShot(c, Anim.Interact, 0.25);
  }

  takeFromStation(c: Character, idx: number): void {
    const it = this.state.items[idx];
    if (it.state !== 'stored' || !this.canCarry(c, it)) return;
    this.grab(c, it);
    this.oneShot(c, Anim.Interact, 0.25);
  }

  storeHeld(c: Character, si: number): void {
    const S = this.state;
    const s = this.map.stations[si];
    let stored = 0;
    for (const i of [...c.hold]) {
      const it = S.items[i];
      if (!this.accepts(si, it)) continue;
      c.hold = c.hold.filter((h) => h !== i);
      this.putInStation(it, si);
      const homes = ITEM_TYPES[it.type].homes ?? [];
      if (homes.includes(s.kind)) {
        it.guardT = GUARD_TIME;
        if (it.disturbed) {
          S.stats.recovered++;
          this.stat(c.id, 'returned');
        }
        it.disturbed = false;
        it.stashed = false;
        it.streetScored = false;
      }
      stored++;
      this.emit({ t: 'store', id: c.id, item: i, station: si });
    }
    if (stored) {
      this.oneShot(c, Anim.Interact, 0.3);
      this.evaluate();
    }
  }

  /** Drops the last held item in front of the character. */
  dropHeld(c: Character, quiet = false): void {
    const S = this.state;
    const i = c.hold.pop();
    if (i === undefined) return;
    const it = S.items[i];
    it.holder = -1;
    it.state = 'free';
    it.y = 0;
    it.tilt = 0;
    const fx = Math.sin(c.facing);
    const fz = Math.cos(c.facing);
    this.placeItemSafely(it, c.x + fx * 0.45, c.z + fz * 0.45);
    this.bump(it);
    if (!quiet) this.oneShot(c, Anim.Interact, 0.2);
    this.emit({ t: 'drop', id: c.id, item: i });
    if (c.role === 'tofu') this.onDogRelease(it);
  }

  private onDogRelease(it: Item) {
    const map = this.map;
    const zn = map.zoneAt(it.x, it.z)?.id ?? '';
    const t = ITEM_TYPES[it.type];
    if (t.category === 'ball') return;
    if (map.streetZones.includes(zn) && it.grabbedIn && !map.outsideZones.includes(it.grabbedIn) && !it.streetScored) {
      it.streetScored = true;
      this.addChaos(CHAOS.streetDrop, 'Objet abandonné dans la rue !', it.x, it.z);
      this.addZoom(this.tofu, 'street');
      this.progressSecret('rue', 1);
    }
    if (it.type === 'baguette' && !map.outsideZones.includes(zn) && zn) {
      this.progressSecret('baguette', 1);
    }
  }

  stash(c: Character, si: number): void {
    const S = this.state;
    const i = c.hold.pop();
    if (i === undefined) return;
    const it = S.items[i];
    this.putInStation(it, si);
    this.oneShot(c, Anim.Interact, 0.3);
    if (!it.stashed && ITEM_TYPES[it.type].category !== 'ball') {
      it.stashed = true;
      S.stats.stashed++;
      this.addChaos(CHAOS.stash, 'Trésor caché !', it.x, it.z);
      this.addZoom(c, 'stash');
      this.progressSecret('tresor', 1);
    }
    if (it.type === 'baguette') this.progressSecret('baguette', 1);
    this.emit({ t: 'store', id: c.id, item: i, station: si });
  }

  takeFromDog(h: Character): void {
    const S = this.state;
    const dog = this.tofu;
    const i = dog.hold.pop();
    if (i === undefined) return;
    const it = S.items[i];
    dog.act = null;
    dog.noPickup = DOG.noPickupAfterTake;
    it.holder = -1;
    if (this.canCarry(h, it)) {
      it.state = 'held';
      it.holder = h.id;
      h.hold.push(i);
    } else {
      it.state = 'free';
      this.placeItemSafely(it, dog.x, dog.z);
    }
    this.bump(it);
    h.takeCd = HUMAN.takeCd;
    it.guardT = GUARD_TIME;
    this.oneShot(h, Anim.Interact, 0.3);
    S.stats.recovered++;
    this.stat(h.id, 'recovered');
    this.say(h.id, this.rng.pick(['Donne !', 'Merci Tofu !', 'Lâche ça !', 'Hop, récupéré !']));
    this.emit({ t: 'recover', id: h.id, item: i });
  }

  wipePaws(h: Character): void {
    const dog = this.tofu;
    if (dog.mud <= 0) return;
    dog.mud = 0;
    this.state.stats.pawsWiped++;
    this.stat(h.id, 'paws');
    this.oneShot(h, Anim.Clean, 0.5);
    this.say(h.id, 'Hop, les pattes !');
    this.emit({ t: 'paws', by: h.id });
  }

  pet(h: Character): void {
    this.oneShot(h, Anim.Pet, 0.8);
    this.say(h.id, this.rng.pick(['Bon chien !', 'Qui est un gentil chien ?', 'Coucou Tofu !']));
    this.emit({ t: 'pet', id: h.id });
  }

  toggleDoor(c: Character, di: number): void {
    const d = this.state.doors[di];
    this.setDoor(di, !d.open, c.id);
    this.oneShot(c, Anim.Interact, 0.25);
  }

  setDoor(di: number, open: boolean, by: number): void {
    const d = this.state.doors[di];
    if (d.open === open) return;
    d.open = open;
    d.push = 0;
    this.bump(d);
    if (!open && this.state.chars[by]?.role === 'human') {
      this.state.stats.doorsClosed++;
      this.stat(by, 'doors');
    }
    this.emit({ t: 'door', door: di, open, by });
  }

  makeBed(h: Character, si: number): void {
    const st = this.state.stations[si];
    st.made = true;
    this.bump(st);
    this.emit({ t: 'bed', made: true });
    this.evaluate();
  }

  water(h: Character, si: number): void {
    const st = this.state.stations[si];
    const can = h.hold.map((i) => this.state.items[i]).find((it) => it.type === 'watering_can');
    if (!can || can.charge <= 0) return;
    can.charge = Math.max(0, can.charge - 1);
    this.bump(can);
    st.watered = true;
    this.bump(st);
    this.emit({ t: 'water', station: si });
    this.evaluate();
  }

  fillCan(h: Character): void {
    const can = h.hold.map((i) => this.state.items[i]).find((it) => it.type === 'watering_can');
    if (!can) return;
    can.charge = 2;
    this.bump(can);
    this.emit({ t: 'water', station: -1 });
  }

  refillTreats(h: Character): void {
    h.treats = HUMAN.treatsMax;
    h.treatJarCd = HUMAN.treatRefillCd;
    this.oneShot(h, Anim.Interact, 0.3);
    this.say(h.id, 'Des friandises pour Tofu !');
  }

  /** The job object (sold at this shop) Tofu ate, if any. */
  restockable(si: number): { item: Item; thanks: string; verb: string } | null {
    const id = this.map.stations[si].id;
    for (const kind of this.map.taskIds) {
      const spec = TASK_DEFS[kind].spec;
      if (spec.type !== 'deliver' || spec.restock?.station !== id) continue;
      const it = this.itemById(spec.item);
      if (it && it.state === 'gone') return { item: it, thanks: spec.restock.thanks, verb: spec.restock.verb };
    }
    return null;
  }

  /** Buys a new job object at a shop (Tofu ate the first one). */
  buy(h: Character, si: number): void {
    const r = this.restockable(si);
    if (!r) return;
    const it = r.item;
    if (!this.canCarry(h, it)) return;
    it.disturbed = false;
    it.stashed = false;
    it.lastStealT = -999;
    it.state = 'held';
    it.holder = h.id;
    h.hold.push(it.idx);
    this.bump(it);
    this.say(h.id, r.thanks);
    this.emit({ t: 'pickup', id: h.id, item: it.idx });
  }

  /** A dirty-paws mess lies on this "make" station (it must be cleaned first). */
  makeDirty(si: number): boolean {
    return this.state.messes.some((m) => m.station === si && MAKE_MESSES.has(m.kind));
  }

  bedJump(c: Character, si: number): void {
    const st = this.state.stations[si];
    const s = this.map.stations[si];
    const mk = makeDef(s);
    c.bedCd = DOG.bedJumpCd;
    this.oneShot(c, Anim.Jump, 0.8);
    if (st.made) {
      st.made = false;
      this.bump(st);
      this.addChaos(CHAOS.bedJump, mk.undone, c.x, c.z);
      this.addZoom(c, 'bed');
      this.emit({ t: 'bed', made: false });
    }
    if (mk.mess && c.mud > 0.15 && !this.makeDirty(si)) {
      this.createMess(mk.mess, s.x, s.z, { station: si, byTofu: true, r: 1.1 });
      const [mud, wet, leaves] = mk.dirty ?? ['Plein de boue !', 'Tout mouillé !', 'Plein de feuilles !'];
      const text = c.pawKind === 'snow' || c.pawKind === 'wet' ? wet : c.pawKind === 'leaves' ? leaves : mud;
      this.addChaos(CHAOS.muddyBed, text, s.x, s.z);
      this.progressSecret('lit_sale', 1);
    }
    this.evaluate();
  }

  sofaJump(c: Character, si: number): void {
    const S = this.state;
    c.bedCd = DOG.bedJumpCd;
    this.oneShot(c, Anim.Jump, 0.8);
    let any = false;
    for (const it of S.items) {
      if (it.type === 'cushion' && it.state === 'home') {
        const a = this.rng.range(0, Math.PI * 2);
        this.knock(it.idx, Math.sin(a), Math.cos(a), 2.5, c.id);
        any = true;
      }
    }
    if (any) this.addChaos(CHAOS.sofaJump, '', c.x, c.z, true);
    if (c.mud > 0.15 && !S.messes.some((m) => m.kind === 'muddy_sofa')) {
      const s = this.map.stations[si];
      this.createMess('muddy_sofa', s.x, s.z, { station: si, byTofu: true, r: 1.0 });
      const text = c.pawKind === 'snow' || c.pawKind === 'wet' ? 'Canapé tout mouillé !' : c.pawKind === 'leaves' ? 'Des feuilles sur le canapé !' : 'Canapé tout boueux !';
      this.addChaos(CHAOS.muddySofa, text, s.x, s.z);
    }
  }

  dig(c: Character, si: number): void {
    const st = this.state.stations[si];
    if (st.dug) return;
    st.dug = true;
    st.watered = false;
    this.bump(st);
    const s = this.map.stations[si];
    const px = clamp(c.x, s.x - (s.hw ?? 0), s.x + (s.hw ?? 0));
    const pz = clamp(c.z, s.z - (s.hd ?? 0), s.z + (s.hd ?? 0));
    this.createMess('dig', px, pz, { station: si, byTofu: true, r: 0.8 });
    c.mud = Math.max(c.mud, 0.6);
    this.addChaos(CHAOS.dig, 'Un trou dans les fleurs !', px, pz);
    this.addZoom(c, 'dig');
    this.progressSecret('creuse', 1);
    this.emit({ t: 'dig', station: si });
    this.evaluate();
  }

  ripBag(c: Character, idx: number): void {
    const it = this.state.items[idx];
    if (it.state !== 'free' || it.charge > 0) return;
    it.charge = 1;
    it.disturbed = true;
    this.bump(it);
    this.createMess('trash', it.x, it.z, { item: idx, byTofu: true, r: 1.0 });
    this.addChaos(CHAOS.ripBag, ITEM_TYPES[it.type].rip?.text ?? 'Éventré !', it.x, it.z);
    this.addZoom(c, 'bin');
    this.progressSecret('poubelles', 1);
    this.oneShot(c, Anim.Interact, 0.4);
  }

  eatHeld(c: Character): void {
    const S = this.state;
    const i = c.hold.find((h) => ITEM_TYPES[S.items[h].type].edible);
    if (i === undefined) return;
    const it = S.items[i];
    c.hold = c.hold.filter((h) => h !== i);
    it.state = 'gone';
    it.holder = -1;
    it.disturbed = false;
    this.bump(it);
    // Bakery and market goods come back on their stall a little later.
    if (ITEM_TYPES[it.type].respawnAt) it.respawnT = BAGUETTE_RESPAWN;
    this.createMess('crumbs', c.x + Math.sin(c.facing) * 0.4, c.z + Math.cos(c.facing) * 0.4, { byTofu: true, r: 0.7 });
    S.stats.eaten++;
    this.addChaos(CHAOS.eat, 'Miam ! Tout mangé !', c.x, c.z);
    this.addZoom(c, 'eat');
    this.progressSecret('gourmand', 1);
    if (ITEM_TYPES[it.type].category === 'market') this.progressSecret('marche', 1);
    this.oneShot(c, Anim.Eat, 0.6);
    this.emit({ t: 'eat', id: c.id, item: i });
    this.evaluate();
  }

  tablecloth(c: Character, si: number): void {
    const S = this.state;
    const st = S.stations[si];
    const i = st.items.find((h) => S.items[h].type === 'dishes');
    if (i === undefined) return;
    const it = S.items[i];
    this.removeFromStation(it);
    it.state = 'gone';
    this.bump(it);
    const s = this.map.stations[si];
    const m = this.createMess('shards', s.x, s.z + 0.8, { item: i, byTofu: true, r: 1.1 });
    it.mess = m.id;
    this.addChaos(CHAOS.tablecloth, 'La nappe ! Toute la vaisselle !', s.x, s.z);
    this.addZoom(c, 'tablecloth');
    this.oneShot(c, Anim.Push, 0.5);
    this.emit({ t: 'knock', item: i, by: c.id, x: s.x, z: s.z });
    this.evaluate();
  }

  // ---------------------------------------------------------------------------
  // Treats
  // ---------------------------------------------------------------------------

  private updateTreats(dt: number) {
    const S = this.state;
    const tofu = this.tofu;
    for (const t of S.treats) {
      if (t.landed) continue;
      t.vy -= GRAVITY * dt;
      const nx = t.x + t.vx * dt;
      const nz = t.z + t.vz * dt;
      const p = { x: nx, z: nz };
      if (resolveCircle(this.ctx, p, 0.08, MASK_ITEM)) {
        t.vx *= 0.3;
        t.vz *= 0.3;
      }
      t.x = p.x;
      t.z = p.z;
      t.y += t.vy * dt;
      if (t.y <= 0.03) {
        t.y = 0.03;
        t.landed = true;
        t.landT = S.time;
        const q = { x: t.x, z: t.z };
        resolveCircle(this.ctx, q, 0.1, MASK_ITEM);
        t.x = q.x;
        t.z = q.z;
      }
    }
    if (tofu.lureKind || tofu.lureImmune > 0 || tofu.stun > 0) return;
    for (const t of S.treats) {
      if (!t.landed) continue;
      const fresh = S.time - t.landT < 1.2;
      const range = fresh ? DOG.lureTreatRange : DOG.treatTrapRange;
      if (dist(tofu.x, tofu.z, t.x, t.z) < range) {
        this.startLure('treat', t.id);
        break;
      }
    }
  }

  // ---------------------------------------------------------------------------
  // Messes, mud, chaos
  // ---------------------------------------------------------------------------

  messById(id: number): Mess | undefined {
    return this.state.messes.find((m) => m.id === id);
  }

  createMess(kind: MessKind, x: number, z: number, o: { item?: number; station?: number; byTofu?: boolean; r?: number } = {}): Mess {
    const S = this.state;
    const zone = this.map.zoneAt(x, z)?.id ?? 'dehors';
    const m: Mess = {
      id: S.nextMessId++, kind, x, z, r: o.r ?? 0.9, zone, progress: 0, item: o.item ?? -1, station: o.station ?? -1,
      prints: [], seed: Math.floor(this.rng.next() * 1e6), byTofu: !!o.byTofu, age: 0, rev: 0,
    };
    S.messes.push(m);
    this.emit({ t: 'mess', mess: m.id, kind, x, z, zone });
    return m;
  }

  /** Removes a mess and restores whatever it was linked to (`cleaned`: by someone, not dried up). */
  removeMess(id: number, by: number, cleaned = true): void {
    const S = this.state;
    const m = this.messById(id);
    if (!m) return;
    S.messes = S.messes.filter((x) => x.id !== id);
    if (isTrail(m.kind)) {
      for (const [k, v] of this.trailCells) if (v === id) this.trailCells.delete(k);
    }
    if (m.item >= 0) {
      const it = S.items[m.item];
      const t = ITEM_TYPES[it.type];
      if (t.knock && it.state === 'knocked') {
        it.state = 'home';
        it.x = it.homeX;
        it.y = it.homeY;
        it.z = it.homeZ;
        it.rot = it.homeRot;
        it.tilt = 0;
        it.knockCd = KNOCK_RESTORE_CD;
        it.mess = -1;
        const stIdx = this.map.stations.findIndex((s) => s.linkedItem === it.id);
        if (stIdx >= 0) {
          S.stations[stIdx].disabled = false;
          this.bump(S.stations[stIdx]);
        }
      } else if (m.kind === 'shards' && it.state === 'gone') {
        it.disturbed = false;
        it.mess = -1;
        // Broken dishes: a clean set comes back to where they belong.
        const home = this.map.items[it.idx].station;
        if (home) this.putInStation(it, this.world.stationIndex.get(home)!);
        else it.state = 'free';
      } else if (m.kind === 'trash' && it.type === 'trash_bag') {
        it.charge = 0;
      }
      this.bump(it);
    }
    if (m.kind === 'dig' && m.station >= 0) {
      S.stations[m.station].dug = false;
      this.bump(S.stations[m.station]);
    }
    if (cleaned) {
      S.stats.messesCleaned++;
      if (by >= 0) this.stat(by, 'cleaned');
    }
    this.emit({ t: 'cleaned', mess: id, kind: m.kind, by, x: m.x, z: m.z });
    this.evaluate();
  }

  cleanMess(c: Character, id: number): void {
    this.removeMess(id, c.id);
  }

  /** Adds a mark (paw print, paper strip) to the trail mess of its 2 m cell. */
  private addTrailMark(kind: TrailKind, px: number, pz: number, rot: number): Mess {
    const key = `${kind}:${Math.floor(px / 2)},${Math.floor(pz / 2)}`;
    const mid = this.trailCells.get(key);
    let m = mid !== undefined ? this.messById(mid) : undefined;
    if (!m) {
      const cx = (Math.floor(px / 2) + 0.5) * 2;
      const cz = (Math.floor(pz / 2) + 0.5) * 2;
      m = this.createMess(kind, cx, cz, { byTofu: true, r: 1.15 });
      this.trailCells.set(key, m.id);
    }
    if (m.prints.length >= 36) m.prints.splice(0, 3);
    // "+ 0" turns -0 into 0, as JSON does on the way to the network clients.
    m.prints.push(Math.round(px * 100) / 100 + 0, Math.round(pz * 100) / 100 + 0, Math.round(rot * 100) / 100 + 0);
    m.progress = 0;
    this.bump(m);
    return m;
  }

  /** One strip of toilet paper behind Tofu; an empty roll goes back to its holder later. */
  private addPaperStrip(c: Character, roll: Item, zoneId: string) {
    const S = this.state;
    const px = c.x - Math.sin(c.facing) * 0.35;
    const pz = c.z - Math.cos(c.facing) * 0.35;
    this.addTrailMark('paper', px, pz, c.facing + (this.rng.next() - 0.5) * 0.8);
    if (roll.charge === PAPER.length) this.emit({ t: 'paper', id: c.id, x: c.x, z: c.z });
    roll.charge--;
    this.bump(roll);
    S.stats.paperUnrolled++;
    this.addChaos(CHAOS.paper, '', px, pz, true);
    this.progressSecret('papier', 1);
    if (S.stats.paperUnrolled % 8 === 1) this.addZoom(c, 'paper');
    if (roll.charge <= 0) {
      // Used up: Tofu drops the empty tube, a new roll appears on the holder later.
      c.hold = c.hold.filter((i) => i !== roll.idx);
      roll.state = 'gone';
      roll.holder = -1;
      roll.disturbed = false;
      roll.respawnT = PAPER.respawn;
      this.bump(roll);
      this.addChaos(2, 'Plus de papier !', c.x, c.z);
    }
    void zoneId;
  }

  /** A print of the dirty paws indoors: mud, wet snow or a few leaves. */
  private addMudPrint(c: Character, zoneId: string) {
    const S = this.state;
    const side = c.printSide;
    c.printSide = -side;
    const leaves = c.pawKind === 'leaves';
    const px = c.x + Math.cos(c.facing) * 0.11 * side;
    const pz = c.z - Math.sin(c.facing) * 0.11 * side;
    this.addTrailMark(PAW_TRAIL[c.pawKind], px, pz, leaves ? c.facing + (this.rng.next() - 0.5) * 2 : c.facing);
    c.mud = Math.max(0, c.mud - (leaves ? DOG.leafPerPrint : DOG.mudPerPrint));
    S.stats.mudPrints++;
    this.addChaos(c.pawKind === 'snow' || c.pawKind === 'wet' ? CHAOS.wetPrint : CHAOS.print, '', px, pz, true);
    if (c.pawKind === 'mud' && this.map.muddyZones.includes(zoneId)) this.progressSecret('boue_chambre', 1);
    if (S.stats.mudPrints % 6 === 1) this.addZoom(c, 'mud');
  }

  /** One drop of the stolen watering can: a wet mark on hard floors, water lost anyway. */
  private addDrip(c: Character, can: Item, zn: Zone | null) {
    const S = this.state;
    can.charge = Math.max(0, can.charge - CAN.perDrip);
    this.bump(can);
    if (zn && (zn.indoor || zn.drips)) {
      const px = c.x - Math.sin(c.facing) * 0.3 + (this.rng.next() - 0.5) * 0.16;
      const pz = c.z - Math.cos(c.facing) * 0.3 + (this.rng.next() - 0.5) * 0.16;
      this.addTrailMark('wet', px, pz, this.rng.next() * Math.PI * 2);
      S.stats.drops++;
      this.addChaos(CAN.dripChaos, '', px, pz, true);
      if (zn.indoor || zn.prints) this.progressSecret('arrosoir', 1);
      if (S.stats.drops % 8 === 1) this.addZoom(c, 'drip');
    }
    if (can.charge <= 0) this.addChaos(1, "L'arrosoir est vide !", c.x, c.z);
  }

  private updateMesses(dt: number) {
    const S = this.state;
    if (!S.messes.length) return;
    for (const m of S.messes) m.age += dt;
    // Water marks dry up by themselves, oldest first.
    for (const m of [...S.messes]) {
      if (m.kind !== 'wet' || m.age < WET.dryAfter) continue;
      if (Math.floor(m.age / WET.dryEvery) === Math.floor((m.age - dt) / WET.dryEvery)) continue;
      m.prints.splice(0, 3);
      this.bump(m);
      if (!m.prints.length) this.removeMess(m.id, -1, false);
    }
    // Water marks dry up anyway: they do not feed the passive chaos.
    const lasting = S.messes.reduce((n, m) => n + (m.kind === 'wet' ? 0 : 1), 0);
    const drip = Math.min(CHAOS.messDripCap, lasting * CHAOS.messDrip) * dt;
    this.addChaos(drip, '', 0, 0, true);
  }

  addChaos(amount: number, reason: string, x: number, z: number, quiet = false): void {
    const S = this.state;
    if (S.phase !== 'play' || amount <= 0) return;
    S.chaos = Math.min(S.chaosGoal, S.chaos + amount);
    if (quiet) {
      this.chaosText += amount;
      if (this.chaosText >= 3) {
        this.emit({ t: 'chaos', amount: Math.round(this.chaosText), reason: '', x: this.tofu.x, z: this.tofu.z });
        this.chaosText = 0;
      }
      return;
    }
    this.emit({ t: 'chaos', amount: Math.round(amount * 10) / 10, reason, x, z });
  }

  progressSecret(id: string, amount: number): void {
    const S = this.state;
    if (S.phase !== 'play') return;
    S.secrets.forEach((s, idx) => {
      if (s.id !== id || s.done) return;
      s.progress = Math.min(s.goal, s.progress + amount);
      if (s.progress >= s.goal) {
        s.done = true;
        this.addChaos(CHAOS.secret, `Défi secret : ${secretInfo(this.map, id).text}`, this.tofu.x, this.tofu.z);
        this.emit({ t: 'secret', idx });
      }
    });
  }
}

function capitalize(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

/** Crude gender detection from the French article ("la ", "une "). */
function feminine(name: string): boolean {
  return name.startsWith('la ') || name.startsWith('une ');
}
