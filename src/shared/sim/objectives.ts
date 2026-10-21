// Where should a human go next for each job? Used by the HUD (arrows, minimap
// markers) and by the human AI. Derived from the job patterns of the map.
import { ITEM_TYPES } from '../world/itemTypes';
import type { Game } from './game';
import { TASK_DEFS } from './rules';
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

function st(g: Game, id: string) {
  const i = g.world.stationIndex.get(id)!;
  return { i, s: g.map.stations[i], state: g.state.stations[i] };
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
    const spec = TASK_DEFS[t.kind].spec;
    switch (spec.type) {
      case 'collect': {
        const pending = spec.items.map((id) => g.itemById(id)!).filter((it) => {
          if (it.state !== 'stored') return true;
          return !(spec.kinds as string[]).includes(g.map.stations[it.station].kind);
        });
        if (pending.some((it) => holds(c, it))) {
          out.push(stationTarget(g, spec.dest, t.kind, spec.destLabel));
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
      case 'deliver': {
        const it = g.itemById(spec.item)!;
        if (holds(c, it)) out.push(stationTarget(g, spec.dest, t.kind, spec.destLabel));
        else if (it.state === 'gone') {
          // Broken: the shards must be cleaned first. Eaten: buy a new one.
          const m = S.messes.find((mm) => mm.item === it.idx);
          if (m) out.push({ task: t.kind, kind: 'station', target: -1, x: m.x, z: m.z, label: `${spec.itemLabel} cassée` });
          else if (spec.restock) out.push(stationTarget(g, spec.restock.station, t.kind, spec.restock.label));
        } else {
          const o = itemTarget(g, it, t.kind, spec.itemLabel);
          if (o) out.push(o);
        }
        break;
      }
      case 'make':
        out.push(stationTarget(g, spec.station, t.kind, spec.label));
        break;
      case 'water': {
        const can = g.itemById(spec.can)!;
        if (holds(c, can)) {
          if (can.charge <= 0) out.push(stationTarget(g, spec.tap, t.kind, spec.tapLabel));
          else {
            for (const id of spec.beds) {
              const s = st(g, id);
              if (!s.state.watered || s.state.dug) {
                out.push(stationTarget(g, id, t.kind, spec.bedLabel));
                break;
              }
            }
          }
        } else {
          const o = itemTarget(g, can, t.kind, ITEM_TYPES[can.type].short.replace(/^./, (ch) => ch.toUpperCase()));
          if (o) out.push(o);
        }
        break;
      }
    }
  }
  return out;
}
