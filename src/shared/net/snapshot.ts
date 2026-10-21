// Delta snapshots: characters, cat and scalars every time; items, stations,
// doors and messes only when their revision changed. WebSockets are reliable
// and ordered, so "changed since the previous broadcast" deltas are safe.
import type { GameEvent, GameState, Mess } from '../sim/types';
import type { Snap } from './protocol';

export class SnapshotEncoder {
  private itemRev: number[] = [];
  private stationRev: number[] = [];
  private doorRev: number[] = [];
  private messRev = new Map<number, number>();
  private count = 0;

  delta(S: GameState, events: GameEvent[]): Snap {
    this.count++;
    const snap: Snap = {
      tick: S.tick, time: S.time, phase: S.phase, countdown: S.countdown, chaos: S.chaos, cleanliness: S.cleanliness,
      guestsT: S.guestsT, winner: S.winner, endReason: S.endReason,
      chars: S.chars, cat: S.cat, carrier: S.carrier, vacuum: S.vacuum, treats: S.treats, tasks: S.tasks, secrets: S.secrets,
      messIds: S.messes.map((m) => m.id), ev: events,
    };
    const items = S.items.filter((it) => this.itemRev[it.idx] !== it.rev);
    if (items.length) snap.items = items;
    for (const it of items) this.itemRev[it.idx] = it.rev;
    const stations = S.stations.filter((st) => this.stationRev[st.idx] !== st.rev);
    if (stations.length) snap.stations = stations;
    for (const st of stations) this.stationRev[st.idx] = st.rev;
    const doors = S.doors.filter((d) => this.doorRev[d.idx] !== d.rev);
    if (doors.length) snap.doors = doors;
    for (const d of doors) this.doorRev[d.idx] = d.rev;
    const messes: Mess[] = [];
    const alive = new Set<number>();
    for (const m of S.messes) {
      alive.add(m.id);
      if (this.messRev.get(m.id) !== m.rev) {
        messes.push(m);
        this.messRev.set(m.id, m.rev);
      }
    }
    for (const id of this.messRev.keys()) if (!alive.has(id)) this.messRev.delete(id);
    if (messes.length) snap.messes = messes;
    if (this.count % 20 === 0 || S.phase === 'end') {
      snap.stats = S.stats;
      snap.charStats = S.charStats;
    }
    return snap;
  }

  /** Forget revisions (next delta sends everything that changed since the full state). */
  resetTo(S: GameState) {
    this.itemRev = S.items.map((i) => i.rev);
    this.stationRev = S.stations.map((s) => s.rev);
    this.doorRev = S.doors.map((d) => d.rev);
    this.messRev = new Map(S.messes.map((m) => [m.id, m.rev]));
  }
}

/** Applies a delta snapshot onto a client-side state (in place). */
export function applySnap(S: GameState, d: Snap): void {
  S.tick = d.tick;
  S.time = d.time;
  S.phase = d.phase;
  S.countdown = d.countdown;
  S.chaos = d.chaos;
  S.cleanliness = d.cleanliness;
  S.guestsT = d.guestsT;
  S.winner = d.winner;
  S.endReason = d.endReason;
  S.chars = d.chars;
  S.cat = d.cat;
  S.carrier = d.carrier;
  S.vacuum = d.vacuum;
  S.treats = d.treats;
  S.tasks = d.tasks;
  S.secrets = d.secrets;
  if (d.items) for (const it of d.items) S.items[it.idx] = it;
  if (d.stations) for (const st of d.stations) S.stations[st.idx] = st;
  if (d.doors) for (const dr of d.doors) S.doors[dr.idx] = dr;
  const byId = new Map(S.messes.map((m) => [m.id, m]));
  if (d.messes) for (const m of d.messes) byId.set(m.id, m);
  S.messes = d.messIds.map((id) => byId.get(id)).filter((m): m is Mess => !!m);
  if (d.stats) S.stats = d.stats;
  if (d.charStats) S.charStats = d.charStats;
}
