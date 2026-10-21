// Context-sensitive interactions. One "action" button does the most relevant
// thing nearby. The same code produces the on-screen prompt (client) and
// validates/executes the action (simulation), so prompts never lie.
import { BAKERY_BUY_TIME, DOG, HUMAN, VACUUM } from '../constants';
import { ITEM_TYPES, MESS_TYPES } from '../world/itemTypes';
import { makeDef } from '../world/types';
import type { StationDef } from '../world/types';
import type { Game } from './game';
import { switchVacuum } from './vacuum';
import type { Character } from './types';

export type IKind =
  | 'pickup' | 'take' | 'store' | 'drop' | 'clean' | 'door' | 'take_dog' | 'paws' | 'pet' | 'bed' | 'water' | 'fill'
  | 'treats' | 'buy' | 'knock' | 'push_bin' | 'push_door' | 'bed_jump' | 'sofa_jump' | 'dig' | 'rip' | 'eat'
  | 'stash' | 'tablecloth' | 'vacuum';

export interface Interaction {
  kind: IKind;
  target: number;
  label: string;
  hold: number;
  x: number;
  y: number;
  z: number;
  score: number;
}

export function stationDist(s: StationDef, x: number, z: number): number {
  const ex = Math.max(Math.abs(x - s.x) - (s.hw ?? 0), 0);
  const ez = Math.max(Math.abs(z - s.z) - (s.hd ?? 0), 0);
  return Math.hypot(ex, ez);
}

function cap(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

/** "le chausson" -> "le chausson"; used in prompts like "Voler le chausson". */
function nm(type: string): string {
  return ITEM_TYPES[type].name;
}

export function listInteractions(g: Game, c: Character): Interaction[] {
  const S = g.state;
  const out: Interaction[] = [];
  if (S.phase !== 'play' || c.stun > 0 || c.lureKind) return out;
  const isDog = c.role === 'tofu';
  const reach = isDog ? DOG.reach : HUMAN.reach;
  const fx = Math.sin(c.facing);
  const fz = Math.cos(c.facing);
  const add = (kind: IKind, target: number, label: string, hold: number, x: number, y: number, z: number, d: number, prio: number) => {
    const dx = x - c.x;
    const dz = z - c.z;
    const dl = Math.hypot(dx, dz);
    const dot = dl > 0.05 ? (dx * fx + dz * fz) / dl : 1;
    out.push({ kind, target, label, hold, x, y, z, score: prio + dot * 4 - d * 5 });
  };
  const held = c.hold.map((i) => S.items[i]);

  // --- Stations (shared geometry) ---
  g.map.stations.forEach((s, si) => {
    const st = S.stations[si];
    const d = stationDist(s, c.x, c.z);
    const within = d <= s.r;
    if (!within) return;
    const contents = st.items.map((i) => S.items[i]);
    if (isDog) {
      if (s.kind === 'dog_basket' && held.length) {
        add('stash', si, `Cacher ${nm(held[0].type)} dans ${s.name}`, 0, s.x, s.y, s.z, d, 90);
      }
      if (!held.length && c.noPickup <= 0 && s.dogReach && !st.disabled && s.kind !== 'dog_basket') {
        // Clothesline/bakery: nearest slot; containers: last stored.
        let best = -1;
        let bestD = Infinity;
        for (const it of contents) {
          if (!ITEM_TYPES[it.type].carry?.dog || it.guardT > 0) continue;
          const dd = Math.hypot(it.x - c.x, it.z - c.z);
          if (s.kind === 'clothesline' && dd > 1.5) continue;
          if (dd < bestD) {
            bestD = dd;
            best = it.idx;
          }
        }
        if (best >= 0) {
          const it = S.items[best];
          const verb = s.kind === 'clothesline' ? 'Tirer' : 'Voler';
          add('take', best, `${verb} ${nm(it.type)}`, 0, it.x, it.y, it.z, Math.min(d, bestD), 58);
        }
      }
      if (s.kind === 'bed' && c.bedCd <= 0) {
        const mk = makeDef(s);
        if (st.made || (mk.mess && c.mud > 0.15 && !g.makeDirty(si))) add('bed_jump', si, mk.jump, 0, s.x, s.y, s.z, d, 45);
      }
      if (s.kind === 'sofa' && c.bedCd <= 0) {
        const cushions = S.items.some((it) => it.type === 'cushion' && it.state === 'home');
        if (cushions || (c.mud > 0.15 && !S.messes.some((m) => m.kind === 'muddy_sofa'))) {
          add('sofa_jump', si, 'Sauter sur le canapé', 0, s.x, s.y, s.z, d, 44);
        }
      }
      if (s.kind === 'flowerbed' && !st.dug && !held.length) {
        add('dig', si, `Creuser ${s.name}`, 1.5, s.x, s.y, s.z, d, 50);
      }
      if (s.kind === 'dining_table' && contents.some((it) => it.type === 'dishes') && !held.length) {
        add('tablecloth', si, 'Tirer la nappe', 0.8, s.x, s.y, s.z, d, 56);
      }
      return;
    }
    // Humans
    if (held.length) {
      const storable = held.filter((it) => g.accepts(si, it));
      if (storable.length) {
        const it = storable[0];
        const t = ITEM_TYPES[it.type];
        let label = `Ranger ${t.name}`;
        let hold = 0;
        switch (s.kind) {
          case 'dining_table': label = 'Mettre la table'; hold = 1.2; break;
          case 'garden_table': label = it.type === 'croissants' ? 'Servir le goûter' : `Poser ${t.name}`; hold = 0.6; break;
          case 'console': label = `Poser ${t.name}`; break;
          case 'street_bin': label = `Jeter ${t.name}`; hold = 0.5; break;
          case 'notice_board': label = `Afficher ${t.name}`; hold = 0.8; break;
          case 'checkout': label = `Installer ${t.name}`; hold = 0.6; break;
          case 'coat_hooks': label = `Accrocher ${t.name}`; break;
          case 'counter': label = `Poser ${t.name}`; break;
          case 'bakery': label = 'Rendre la baguette'; break;
          case 'market': label = `Rendre ${t.name} au marchand`; break;
          case 'hamper': case 'dresser': case 'toybox': case 'shop_shelf':
            label = storable.length > 1 ? `Ranger ${storable.length} objets` : `Ranger ${t.name}`;
            break;
          case 'clothes_rack':
            label = storable.length > 1 ? `Accrocher ${storable.length} vêtements` : `Accrocher ${t.name}`;
            break;
          case 'gift_table':
            label = storable.length > 1 ? `Poser ${storable.length} cadeaux` : `Poser ${t.name}`;
            break;
        }
        add('store', si, label, hold, s.x, s.y, s.z, d, 85);
      }
      const can = held.find((it) => it.type === 'watering_can');
      if (can) {
        if (s.kind === 'flowerbed' && !st.watered && !st.dug && can.charge > 0) {
          add('water', si, `Arroser ${s.name}`, 1.4, s.x, s.y, s.z, d, 80);
        }
        if (s.kind === 'tap' && can.charge < 2) {
          add('fill', si, "Remplir l'arrosoir", 1.0, s.x, s.y, s.z, d, 80);
        }
      }
    }
    if (g.canCarryAny(c)) {
      // Take from stations that are sources for humans.
      const takeable = s.kind === 'clothesline' || s.kind === 'cupboard' || s.kind === 'mailbox' || s.kind === 'counter' || s.kind === 'dog_basket';
      if (takeable) {
        let best = -1;
        let bestD = Infinity;
        for (const it of contents) {
          if (!g.canCarry(c, it)) continue;
          const dd = Math.hypot(it.x - c.x, it.z - c.z);
          if (s.kind === 'clothesline' && dd > 1.7) continue;
          if (dd < bestD) {
            bestD = dd;
            best = it.idx;
          }
        }
        if (best >= 0) {
          const it = S.items[best];
          const verb = s.kind === 'clothesline' ? 'Décrocher' : s.kind === 'dog_basket' ? 'Reprendre' : 'Prendre';
          add('take', best, `${verb} ${nm(it.type)}`, 0, it.x, it.y, it.z, Math.min(d, bestD), 58);
        }
      }
      // A shop sells a new job object when Tofu ate it.
      const r = g.restockable(si);
      if (r && g.canCarry(c, r.item)) add('buy', si, r.verb, BAKERY_BUY_TIME, s.x, s.y, s.z, d, 75);
    }
    if (s.kind === 'treat_jar' && c.treats < HUMAN.treatsMax && c.treatJarCd <= 0) {
      add('treats', si, 'Prendre des friandises', 0, s.x, s.y, s.z, d, 40);
    }
    if (s.kind === 'bed' && !st.made && !g.makeDirty(si)) {
      add('bed', si, makeDef(s).verb, 2.0, s.x, s.y, s.z, d, 62);
    }
  });

  // --- Free items ---
  for (const it of S.items) {
    if (it.state !== 'free') continue;
    const t = ITEM_TYPES[it.type];
    const d = Math.hypot(it.x - c.x, it.z - c.z) - t.size;
    if (d > reach) continue;
    if (isDog) {
      if (!held.length && c.noPickup <= 0 && t.carry?.dog && it.guardT <= 0) {
        add('pickup', it.idx, `Attraper ${t.name}`, 0, it.x, it.y, it.z, d, 60);
      }
      if (t.rip && it.state === 'free' && it.charge <= 0 && !held.length) {
        add('rip', it.idx, t.rip.verb, 1.0, it.x, it.y, it.z, d, 52);
      }
    } else if (g.canCarry(c, it)) {
      add('pickup', it.idx, `Ramasser ${t.name}`, 0, it.x, it.y, it.z, d, 60);
    }
  }

  // --- Knockables (dog only, on purpose) ---
  if (isDog && !held.length) {
    for (const it of S.items) {
      if (it.state !== 'home' || it.knockCd > 0) continue;
      const t = ITEM_TYPES[it.type];
      if (!t.knock || it.y > DOG.knockReachY) continue;
      const d = Math.hypot(it.x - c.x, it.z - c.z) - t.size;
      if (d > reach) continue;
      if (t.knock.push > 0) add('push_bin', it.idx, `Renverser ${t.name}`, t.knock.push, it.x, it.y, it.z, d, 55);
      else add('knock', it.idx, `Faire tomber ${t.name}`, 0, it.x, it.y, it.z, d, 55);
    }
  }

  // --- Messes (humans clean) ---
  if (!isDog) {
    for (const m of S.messes) {
      const d = Math.hypot(m.x - c.x, m.z - c.z) - m.r;
      if (d > reach) continue;
      const def = MESS_TYPES[m.kind];
      add('clean', m.id, def.verb, def.clean, m.x, 0, m.z, Math.max(0, d), 65);
    }
  }

  // --- Doors ---
  g.map.doors.forEach((dd, di) => {
    const ds = S.doors[di];
    const b = g.world.doorBoxes[di];
    const ex = Math.max(b.x0 - c.x, 0, c.x - b.x1);
    const ez = Math.max(b.z0 - c.z, 0, c.z - b.z1);
    const d = Math.hypot(ex, ez);
    if (d > (isDog ? 0.75 : 1.1)) return;
    // Standing against a closed door and facing it: opening it comes first,
    // even with a mess or an item within reach.
    const dl = Math.hypot(dd.x - c.x, dd.z - c.z);
    const facing = dl > 0.05 ? ((dd.x - c.x) * fx + (dd.z - c.z) * fz) / dl : 1;
    const prio = !ds.open && d < 0.45 && facing > 0.5 ? 75 : 35;
    if (isDog) {
      if (!ds.open && dd.dogCanPush) add('push_door', di, `Pousser ${dd.name}`, DOG.pushDoorTime, dd.x, 1, dd.z, d, prio);
    } else {
      add('door', di, `${ds.open ? 'Fermer' : 'Ouvrir'} ${dd.name}`, 0, dd.x, 1, dd.z, d, prio);
    }
  });

  // --- Robot vacuum ---
  {
    const v = S.vacuum;
    const dv = Math.hypot(v.x - c.x, v.z - c.z) - VACUUM.radius;
    if (dv < reach) {
      const name = g.map.vacuum.name;
      if (v.mode === 'dock' && v.t <= 0) add('vacuum', 0, `Allumer ${name}`, 0, v.x, 0.1, v.z, dv, isDog ? 50 : 22);
      else if (v.mode === 'run' && !isDog) add('vacuum', 0, `Éteindre ${name}`, 0, v.x, 0.1, v.z, dv, 70);
    }
  }

  // --- Characters ---
  if (!isDog) {
    const dog = g.tofu;
    const d = Math.hypot(dog.x - c.x, dog.z - c.z) - DOG.radius;
    if (d <= reach + 0.15) {
      if (dog.hold.length && c.takeCd <= 0) {
        const it = S.items[dog.hold[0]];
        add('take_dog', dog.id, `Reprendre ${nm(it.type)}`, 0, dog.x, 0.5, dog.z, d, 100);
      } else if (dog.mud > 0.08) {
        add('paws', dog.id, 'Essuyer les pattes de Tofu', 0, dog.x, 0.4, dog.z, d, 95);
      } else {
        add('pet', dog.id, 'Caresser Tofu', 0, dog.x, 0.5, dog.z, d, 15);
      }
    }
  }

  // --- Held items ---
  if (held.length) {
    const top = held[held.length - 1];
    if (isDog) {
      if (ITEM_TYPES[top.type].edible) add('eat', top.idx, `Manger ${nm(top.type)}`, DOG.eatTime, c.x, 0.4, c.z, 0, 70);
      add('drop', top.idx, `Lâcher ${nm(top.type)}`, 0, c.x, 0.3, c.z, 0, 20);
    } else {
      add('drop', top.idx, `Poser ${nm(top.type)}`, 0, c.x, 0.3, c.z, 0, 10);
    }
  }

  out.sort((a, b) => b.score - a.score);
  return out;
}

export function findInteraction(g: Game, c: Character): Interaction | null {
  return listInteractions(g, c)[0] ?? null;
}

export function executeInteraction(g: Game, c: Character, it: Interaction): void {
  switch (it.kind) {
    case 'pickup': g.pickup(c, it.target); break;
    case 'take': g.takeFromStation(c, it.target); break;
    case 'store': g.storeHeld(c, it.target); break;
    case 'drop': g.dropHeld(c); break;
    case 'clean': g.cleanMess(c, it.target); break;
    case 'door': g.toggleDoor(c, it.target); break;
    case 'push_door': g.setDoor(it.target, true, c.id); break;
    case 'take_dog': g.takeFromDog(c); break;
    case 'paws': g.wipePaws(c); break;
    case 'pet': g.pet(c); break;
    case 'bed': g.makeBed(c, it.target); break;
    case 'water': g.water(c, it.target); break;
    case 'fill': g.fillCan(c); break;
    case 'treats': g.refillTreats(c); break;
    case 'buy': g.buy(c, it.target); break;
    case 'knock':
    case 'push_bin': g.knock(it.target, Math.sin(c.facing), Math.cos(c.facing), 3.5, c.id); break;
    case 'bed_jump': g.bedJump(c, it.target); break;
    case 'sofa_jump': g.sofaJump(c, it.target); break;
    case 'vacuum': switchVacuum(g, c); break;
    case 'dig': g.dig(c, it.target); break;
    case 'rip': g.ripBag(c, it.target); break;
    case 'eat': g.eatHeld(c); break;
    case 'stash': g.stash(c, it.target); break;
    case 'tablecloth': g.tablecloth(c, it.target); break;
  }
}

export { cap };
