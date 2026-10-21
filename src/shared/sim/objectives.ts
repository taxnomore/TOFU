// Where should a human go next for each household job? Used by the HUD
// (arrows, minimap markers) and by the human AI.
import { ITEM_TYPES } from '../world/itemTypes';
import { STATIONS } from '../world/map';
import type { Game } from './game';
import type { Character, Item, TaskKind } from './types';

export interface Objective {
  task: TaskKind;
  /** 'item': pick this item up, 'station': bring/use at this station. */
  kind: 'item' | 'station';
  target: number;
  x: number;
  z: number;
  label: string;
}

const LINE_ITEMS = ['linge_1', 'linge_2', 'linge_3', 'linge_4'];
const TOYS = ['jouet_nounours', 'jouet_voiture', 'jouet_canard', 'jouet_dino'];

function st(g: Game, id: string) {
  const i = g.world.stationIndex.get(id)!;
  return { i, s: STATIONS[i], state: g.state.stations[i] };
}

function itemTarget(g: Game, it: Item, task: TaskKind, label: string): Objective | null {
  if (it.state === 'gone') return null;
  if (it.state === 'held') {
    const h = g.state.chars[it.holder];
    return { task, kind: 'item', target: it.idx, x: h.x, z: h.z, label };
  }
  return { task, kind: 'item', target: it.idx, x: it.x, z: it.z, label };
}

function stationTarget(g: Game, id: string, task: TaskKind, label: string): Objective {
  const { i, s } = st(g, id);
  return { task, kind: 'station', target: i, x: s.x, z: s.z, label };
}

function holds(c: Character, it: Item | undefined) {
  return !!it && it.state === 'held' && it.holder === c.id;
}

/** Next step for each incomplete job, from the point of view of human c. */
export function objectivesFor(g: Game, c: Character): Objective[] {
  const out: Objective[] = [];
  const S = g.state;
  for (const t of S.tasks) {
    if (t.done) continue;
    switch (t.kind) {
      case 'linge':
      case 'jouets': {
        const ids = t.kind === 'linge' ? LINE_ITEMS : TOYS;
        const dest = t.kind === 'linge' ? 'panier_linge' : 'coffre_jouets';
        const pending = ids.map((id) => g.itemById(id)!).filter((it) => {
          if (it.state !== 'stored') return true;
          const k = STATIONS[it.station].kind;
          return t.kind === 'linge' ? k !== 'hamper' && k !== 'dresser' : k !== 'toybox';
        });
        if (pending.some((it) => holds(c, it))) {
          out.push(stationTarget(g, dest, t.kind, t.kind === 'linge' ? 'Panier à linge' : 'Coffre à jouets'));
        } else {
          let best: Objective | null = null;
          let bd = Infinity;
          for (const it of pending) {
            const o = itemTarget(g, it, t.kind, ITEM_TYPES[it.type].short);
            if (!o) continue;
            const d = Math.hypot(o.x - c.x, o.z - c.z);
            if (d < bd) {
              bd = d;
              best = o;
            }
          }
          if (best) out.push(best);
        }
        break;
      }
      case 'table': {
        const it = g.itemById('vaisselle')!;
        if (holds(c, it)) out.push(stationTarget(g, 'table_salon', 'table', 'Table du salon'));
        else if (it.state === 'gone') {
          // Broken: the shards must be cleaned first.
          const m = S.messes.find((mm) => mm.item === it.idx);
          if (m) out.push({ task: 'table', kind: 'station', target: -1, x: m.x, z: m.z, label: 'Vaisselle cassée' });
        } else {
          const o = itemTarget(g, it, 'table', 'Vaisselle');
          if (o) out.push(o);
        }
        break;
      }
      case 'gouter': {
        const it = g.itemById('croissants')!;
        if (holds(c, it)) out.push(stationTarget(g, 'table_jardin', 'gouter', 'Table du jardin'));
        else if (it.state === 'gone') out.push(stationTarget(g, 'boulangerie', 'gouter', 'Boulangerie'));
        else {
          const o = itemTarget(g, it, 'gouter', 'Croissants');
          if (o) out.push(o);
        }
        break;
      }
      case 'poubelle': {
        const it = g.itemById('sac_poubelle')!;
        if (holds(c, it)) out.push(stationTarget(g, 'poubelle_rue', 'poubelle', 'Poubelle de la rue'));
        else {
          const o = itemTarget(g, it, 'poubelle', 'Sac poubelle');
          if (o) out.push(o);
        }
        break;
      }
      case 'courrier': {
        const it = g.itemById('courrier')!;
        if (holds(c, it)) out.push(stationTarget(g, 'console', 'courrier', 'Console'));
        else {
          const o = itemTarget(g, it, 'courrier', 'Courrier');
          if (o) out.push(o);
        }
        break;
      }
      case 'lit':
        out.push(stationTarget(g, 'lit', 'lit', 'Lit'));
        break;
      case 'fleurs': {
        const can = g.itemById('arrosoir')!;
        if (holds(c, can)) {
          if (can.charge <= 0) out.push(stationTarget(g, 'robinet', 'fleurs', 'Robinet'));
          else {
            for (const id of ['massif_est', 'massif_sud']) {
              const s = st(g, id);
              if (!s.state.watered || s.state.dug) {
                out.push(stationTarget(g, id, 'fleurs', 'Massif'));
                break;
              }
            }
          }
        } else {
          const o = itemTarget(g, can, 'fleurs', 'Arrosoir');
          if (o) out.push(o);
        }
        break;
      }
    }
  }
  return out;
}
