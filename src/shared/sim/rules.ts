// Jobs (humans), secret mischief challenges (Tofu) and cleanliness.
// Jobs are predicates over the world state, so the checklist always reflects
// what is really in place (a job can be undone by Tofu and redone). Each map
// describes its jobs with a few patterns (see TaskSpec).
import { CLEANLINESS, TASKS_PER_HUMANS, PAPER } from '../constants';
import { Rng } from '../math';
import { ITEM_TYPES, MESS_TYPES, isTrail } from '../world/itemTypes';
import type { GameMap, TaskInfo, TaskSpec } from '../world/mapTypes';
import { ALL_TASK_INFO } from '../world/maps';
import type { Variant } from '../world/variants';
import type { Game } from './game';
import type { GameState, SecretState, TaskKind, TaskState } from './types';

export interface TaskDef extends TaskInfo {
  kind: TaskKind;
  eval(g: Game): { progress: number; total: number };
}

function storedKind(g: Game, itemId: string): string | null {
  const it = g.itemById(itemId);
  if (!it || it.state !== 'stored') return null;
  return g.map.stations[it.station].kind;
}

function storedAt(g: Game, itemId: string, stationId: string): boolean {
  const it = g.itemById(itemId);
  return !!it && it.state === 'stored' && g.map.stations[it.station].id === stationId;
}

/** Is a "make" station done (made, and no dirty mess on it)? */
export function madeStation(g: Game, stationId: string): boolean {
  const si = g.world.stationIndex.get(stationId);
  if (si === undefined) return false;
  const st = g.state.stations[si];
  return st.made && !g.makeDirty(si);
}

export function evalSpec(g: Game, spec: TaskSpec): { progress: number; total: number } {
  switch (spec.type) {
    case 'collect': {
      let n = 0;
      for (const id of spec.items) {
        const k = storedKind(g, id);
        if (k && (spec.kinds as string[]).includes(k)) n++;
      }
      return { progress: n, total: spec.items.length };
    }
    case 'deliver':
      return { progress: storedAt(g, spec.item, spec.dest) ? 1 : 0, total: 1 };
    case 'make':
      return { progress: madeStation(g, spec.station) ? 1 : 0, total: 1 };
    case 'water': {
      let n = 0;
      for (const id of spec.beds) {
        const st = g.stationById(id);
        if (st && st.watered && !st.dug) n++;
      }
      return { progress: n, total: spec.beds.length };
    }
  }
}

/** Every job of every map (ids are unique). */
export const TASK_DEFS: Record<TaskKind, TaskDef> = Object.fromEntries(
  Object.entries(ALL_TASK_INFO).map(([kind, info]) => [kind, { ...info, kind, eval: (g: Game) => evalSpec(g, info.spec) }]),
);

export function chooseTasks(rng: Rng, humanCount: number, map: GameMap): TaskKind[] {
  const n = TASKS_PER_HUMANS[Math.max(1, Math.min(2, humanCount))];
  const [first, ...others] = map.taskIds;
  const rest = rng.shuffle(others);
  return [first, ...rest.slice(0, n - 1)];
}

export interface SecretDef {
  id: string;
  text: string;
  goal: number;
  icon: string;
  /** Only offered in this ambiance (and always offered there). */
  variant?: Variant;
}

export const SECRET_DEFS: SecretDef[] = [
  { id: 'voleur', text: 'Vole 5 vêtements (chaussettes, slips, chaussons…)', goal: 5, icon: '🧦' },
  { id: 'tresor', text: 'Cache 3 objets dans ton panier ou ta niche', goal: 3, icon: '💎' },
  { id: 'rue', text: 'Emporte un objet de la maison jusque dans la rue', goal: 1, icon: '🛣️' },
  { id: 'casse', text: 'Fais tomber 5 objets', goal: 5, icon: '💥' },
  { id: 'boue_chambre', text: 'Laisse 12 traces de boue dans les chambres', goal: 12, icon: '🐾' },
  { id: 'chat', text: 'Poursuis le chat pendant 8 secondes', goal: 8, icon: '🐈' },
  { id: 'poubelles', text: 'Renverse 2 poubelles', goal: 2, icon: '🗑️' },
  { id: 'gourmand', text: 'Mange quelque chose de bon', goal: 1, icon: '🥐' },
  { id: 'innocent', text: "Assieds-toi l'air innocent à côté d'une bêtise", goal: 1, icon: '😇' },
  { id: 'zoomies', text: 'Déclenche tes zoomies dans la maison', goal: 1, icon: '💨' },
  { id: 'lit_sale', text: 'Saute sur le lit avec les pattes pleines de boue', goal: 1, icon: '🛏️' },
  { id: 'baguette', text: 'Rapporte la baguette de la boulangerie à la maison', goal: 1, icon: '🥖' },
  { id: 'creuse', text: 'Creuse un trou dans un massif de fleurs', goal: 1, icon: '🕳️' },
  { id: 'aboie', text: 'Fais sursauter les humains 3 fois en aboyant', goal: 3, icon: '📢' },
  { id: 'facteur', text: 'Aboie sur la factrice quand elle passe', goal: 1, icon: '📮' },
  { id: 'papier', text: 'Déroule 25 feuilles de papier toilette', goal: 25, icon: '🧻' },
  { id: 'chaine', text: "Fais renverser 2 objets par le chat ou par l'aspirateur", goal: 2, icon: '⛓️' },
  { id: 'arrosoir', text: "Vole l'arrosoir et laisse 15 gouttes dans la maison", goal: 15, icon: '🚿' },
  { id: 'feuilles', text: 'Éparpille 4 tas de feuilles', goal: 4, icon: '🍂', variant: 'automne' },
  { id: 'bonhomme', text: 'Démolis les 2 bonshommes de neige', goal: 2, icon: '⛄', variant: 'hiver' },
  { id: 'marche', text: 'Mange 2 bonnes choses volées au marché', goal: 2, icon: '🧀', variant: 'marche' },
];

export function secretDef(id: string): SecretDef {
  return SECRET_DEFS.find((s) => s.id === id)!;
}

/** Icon and wording of a challenge on this map. */
export function secretInfo(map: GameMap, id: string): { icon: string; text: string } {
  const d = secretDef(id);
  return { icon: d.icon, text: map.secretText(id, d.text) };
}

export function chooseSecrets(rng: Rng, humanCount: number, variant: Variant, map: GameMap): SecretState[] {
  let pool = SECRET_DEFS.filter((s) => !s.variant && map.secrets.includes(s.id) && (s.id !== 'aboie' || humanCount > 0));
  pool = rng.shuffle([...pool]);
  // The ambiance always brings its own challenge.
  const own = SECRET_DEFS.filter((s) => s.variant === variant);
  return [...own, ...pool].slice(0, 3).map((s) => ({ id: s.id, progress: 0, goal: s.goal, done: false }));
}

/** Cleanliness in percent, computed from messes and misplaced objects. */
export function computeCleanliness(g: Game): number {
  const S: GameState = g.state;
  let dirt = 0;
  for (const m of S.messes) {
    const def = MESS_TYPES[m.kind];
    let d = def.dirt;
    // A trail is fully dirty once it holds a few marks.
    if (isTrail(m.kind)) d *= Math.min(1, m.prints.length / 3 / (m.kind === 'paper' ? PAPER.fullStrips : CLEANLINESS.mudFullPrints));
    dirt += d * zoneFactor(g.map, m.zone);
  }
  for (const it of S.items) {
    if (!it.disturbed) continue;
    const t = ITEM_TYPES[it.type];
    if (t.neverMess) continue;
    if (it.state === 'free' || it.state === 'air') {
      dirt += CLEANLINESS.misplacedItem;
    } else if (it.state === 'held') {
      if (S.chars[it.holder]?.role === 'tofu') dirt += CLEANLINESS.misplacedItem;
    } else if (it.state === 'stored') {
      const homes = t.homes ?? [];
      if (!homes.includes(g.map.stations[it.station].kind)) dirt += CLEANLINESS.misplacedItem;
    }
  }
  return Math.max(0, Math.min(100, 100 - dirt));
}

export function zoneFactor(map: GameMap, zoneId: string): number {
  const z = map.zoneById(zoneId);
  if (!z) return CLEANLINESS.outsideFactor;
  if (z.indoor || z.prints) return 1;
  if (map.outsideZones.includes(zoneId)) return CLEANLINESS.outsideFactor;
  return CLEANLINESS.outdoorFactor;
}

export function evaluateTasks(g: Game): void {
  const S = g.state;
  S.tasks.forEach((t: TaskState, i: number) => {
    const r = TASK_DEFS[t.kind].eval(g);
    t.progress = r.progress;
    t.total = r.total;
    const done = r.progress >= r.total;
    if (done !== t.done) {
      t.done = done;
      if (done) S.stats.tasksDone++;
      g.emit({ t: 'task', idx: i, done });
    }
  });
}

/** The jobs of this round, with their patterns. */
export function taskSpecs(g: Game): { kind: TaskKind; done: boolean; spec: TaskSpec }[] {
  return g.state.tasks.map((t) => ({ kind: t.kind, done: t.done, spec: TASK_DEFS[t.kind].spec }));
}
