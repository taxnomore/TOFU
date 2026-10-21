// Household jobs (humans), secret mischief challenges (Tofu) and cleanliness.
// Jobs are predicates over the world state, so the checklist always reflects
// what is really in the house (a job can be undone by Tofu and redone).
import { CLEANLINESS, TASKS_PER_HUMANS } from '../constants';
import { Rng } from '../math';
import { ITEM_TYPES, MESS_TYPES } from '../world/itemTypes';
import { OUTSIDE_PROPERTY_ZONES, STATIONS, zoneById } from '../world/map';
import type { Game } from './game';
import type { GameState, SecretState, TaskKind, TaskState } from './types';

export interface TaskDef {
  kind: TaskKind;
  title: string;
  hint: string;
  icon: string;
  eval(g: Game): { progress: number; total: number };
}

function stationKindOf(g: Game, itemId: string): string | null {
  const it = g.itemById(itemId);
  if (!it || it.state !== 'stored') return null;
  return STATIONS[it.station].kind;
}

function storedAt(g: Game, itemId: string, stationId: string): boolean {
  const it = g.itemById(itemId);
  return !!it && it.state === 'stored' && STATIONS[it.station].id === stationId;
}

export const TASK_DEFS: Record<TaskKind, TaskDef> = {
  linge: {
    kind: 'linge', title: 'Rentrer le linge', icon: '🧺',
    hint: 'Décroche le linge du jardin et range-le dans le panier à linge de la salle de bain (Tofu ne sait pas l\'ouvrir !).',
    eval(g) {
      const ids = ['linge_1', 'linge_2', 'linge_3', 'linge_4'];
      let n = 0;
      for (const id of ids) {
        const k = stationKindOf(g, id);
        if (k === 'hamper' || k === 'dresser') n++;
      }
      return { progress: n, total: ids.length };
    },
  },
  jouets: {
    kind: 'jouets', title: 'Ranger les jouets', icon: '🧸',
    hint: 'Mets les 4 jouets dans le coffre de la chambre des enfants.',
    eval(g) {
      const ids = ['jouet_nounours', 'jouet_voiture', 'jouet_canard', 'jouet_dino'];
      let n = 0;
      for (const id of ids) if (stationKindOf(g, id) === 'toybox') n++;
      return { progress: n, total: ids.length };
    },
  },
  table: {
    kind: 'table', title: 'Mettre la table', icon: '🍽️',
    hint: 'Prends la vaisselle dans le placard de la cuisine et mets la table du salon.',
    eval(g) {
      return { progress: storedAt(g, 'vaisselle', 'table_salon') ? 1 : 0, total: 1 };
    },
  },
  gouter: {
    kind: 'gouter', title: 'Servir le goûter', icon: '🥐',
    hint: 'Pose les croissants de la cuisine sur la table du jardin. Si Tofu les mange, rachète-en à la boulangerie !',
    eval(g) {
      return { progress: storedAt(g, 'croissants', 'table_jardin') ? 1 : 0, total: 1 };
    },
  },
  poubelle: {
    kind: 'poubelle', title: 'Sortir la poubelle', icon: '🗑️',
    hint: 'Jette le sac poubelle de la cuisine dans la grande poubelle sur le trottoir.',
    eval(g) {
      return { progress: storedAt(g, 'sac_poubelle', 'poubelle_rue') ? 1 : 0, total: 1 };
    },
  },
  courrier: {
    kind: 'courrier', title: 'Relever le courrier', icon: '✉️',
    hint: "Prends le courrier dans la boîte aux lettres (près du portail) et pose-le sur la console de l'entrée.",
    eval(g) {
      return { progress: storedAt(g, 'courrier', 'console') ? 1 : 0, total: 1 };
    },
  },
  lit: {
    kind: 'lit', title: 'Faire le lit', icon: '🛏️',
    hint: 'Va dans la chambre et fais le lit (maintiens le bouton).',
    eval(g) {
      const st = g.stationById('lit');
      const muddy = g.state.messes.some((m) => m.kind === 'muddy_bed');
      return { progress: st && st.made && !muddy ? 1 : 0, total: 1 };
    },
  },
  fleurs: {
    kind: 'fleurs', title: 'Arroser les fleurs', icon: '🌷',
    hint: "Prends l'arrosoir sur la terrasse et arrose les 2 massifs du jardin.",
    eval(g) {
      let n = 0;
      for (const id of ['massif_est', 'massif_sud']) {
        const st = g.stationById(id);
        if (st && st.watered && !st.dug) n++;
      }
      return { progress: n, total: 2 };
    },
  },
};

export const ALL_TASKS: TaskKind[] = ['linge', 'jouets', 'table', 'gouter', 'poubelle', 'courrier', 'lit', 'fleurs'];

export function chooseTasks(rng: Rng, humanCount: number): TaskKind[] {
  const n = TASKS_PER_HUMANS[Math.max(1, Math.min(2, humanCount))];
  const rest = rng.shuffle(ALL_TASKS.filter((t) => t !== 'linge'));
  return ['linge', ...rest.slice(0, n - 1)];
}

export interface SecretDef {
  id: string;
  text: string;
  goal: number;
  icon: string;
  /** Requires the carrier NPC or another feature. */
  needs?: string;
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
  { id: 'facteur', text: 'Aboie sur la factrice quand elle passe', goal: 1, icon: '📮', needs: 'carrier' },
];

export function secretDef(id: string): SecretDef {
  return SECRET_DEFS.find((s) => s.id === id)!;
}

export function chooseSecrets(rng: Rng, humanCount: number): SecretState[] {
  let pool = SECRET_DEFS.filter((s) => s.id !== 'aboie' || humanCount > 0);
  pool = rng.shuffle([...pool]);
  return pool.slice(0, 3).map((s) => ({ id: s.id, progress: 0, goal: s.goal, done: false }));
}

/** Cleanliness in percent, computed from messes and misplaced objects. */
export function computeCleanliness(g: Game): number {
  const S: GameState = g.state;
  let dirt = 0;
  for (const m of S.messes) {
    const def = MESS_TYPES[m.kind];
    let d = def.dirt;
    if (m.kind === 'mud') d *= Math.min(1, m.prints.length / 3 / CLEANLINESS.mudFullPrints);
    dirt += d * zoneFactor(m.zone);
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
      if (!homes.includes(STATIONS[it.station].kind)) dirt += CLEANLINESS.misplacedItem;
    }
  }
  return Math.max(0, Math.min(100, 100 - dirt));
}

export function zoneFactor(zoneId: string): number {
  const z = zoneById(zoneId);
  if (!z) return CLEANLINESS.outsideFactor;
  if (z.indoor) return 1;
  if (OUTSIDE_PROPERTY_ZONES.includes(zoneId)) return CLEANLINESS.outsideFactor;
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
