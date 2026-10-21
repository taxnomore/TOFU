// LAN protocol (JSON over WebSocket). The server is authoritative: clients only
// send inputs and lobby choices; everything else is validated server-side.
import { BTN_ALL } from '../constants';
import type { GameConfig, GameEvent, GameState } from '../sim/types';

export const PROTOCOL_VERSION = 1;
export const MAX_PLAYERS = 3;
export const MAX_SEATS_PER_CLIENT = 3;
export const SNAPSHOT_EVERY = 3; // ticks (60 Hz / 3 = 20 Hz)

export type RolePref = 'tofu' | 'human' | 'any';

export interface SeatReq {
  name: string;
  avatar: number;
  pref: RolePref;
  device: 'touch' | 'keyboard' | 'gamepad';
}

export interface LobbyPlayer {
  key: string;
  clientId: string;
  seat: number;
  name: string;
  avatar: number;
  pref: RolePref;
  role: 'tofu' | 'human' | 'wait';
  ready: boolean;
  connected: boolean;
  device: string;
}

export interface LobbySettings {
  duration: number;
  fillAI: boolean;
  difficulty: number;
}

// ---- Client -> server ----
export type ClientMsg =
  | { t: 'hello'; v: number; clientId: string; seats: SeatReq[] }
  | { t: 'seat'; seat: number; name?: string; avatar?: number; pref?: RolePref }
  | { t: 'add_seat'; seat: SeatReq }
  | { t: 'remove_seat'; seat: number }
  | { t: 'ready'; ready: boolean }
  | { t: 'settings'; settings: Partial<LobbySettings> }
  | { t: 'assign'; key: string; role: 'tofu' | 'human' }
  | { t: 'start' }
  | { t: 'in'; f: [number, number, number, number, number][] }
  | { t: 'rematch'; rotate: boolean }
  | { t: 'to_lobby' }
  | { t: 'ping'; c: number };

// ---- Server -> client ----
export type ServerMsg =
  | { t: 'welcome'; clientId: string; host: boolean; lanUrls: string[] }
  | { t: 'lobby'; players: LobbyPlayer[]; settings: LobbySettings; hostId: string; phase: 'lobby' | 'game'; ai: { tofu: boolean; humans: number } }
  | { t: 'start'; cfg: GameConfig; you: { seat: number; charId: number }[]; state: GameState }
  | { t: 'snap'; ack: Record<number, number>; d: Snap }
  | { t: 'pong'; c: number; s: number }
  | { t: 'error'; msg: string };

export interface Snap {
  tick: number;
  time: number;
  phase: GameState['phase'];
  countdown: number;
  chaos: number;
  cleanliness: number;
  guestsT: number;
  winner: GameState['winner'];
  endReason: string;
  chars: GameState['chars'];
  cat: GameState['cat'];
  carrier: GameState['carrier'];
  treats: GameState['treats'];
  tasks: GameState['tasks'];
  secrets: GameState['secrets'];
  items?: GameState['items'];
  stations?: GameState['stations'];
  doors?: GameState['doors'];
  messIds: number[];
  messes?: GameState['messes'];
  stats?: GameState['stats'];
  charStats?: GameState['charStats'];
  ev: GameEvent[];
}

const isNum = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v);

export function sanitizeName(n: unknown, fallback = 'Joueur'): string {
  if (typeof n !== 'string') return fallback;
  const s = n.replace(/[<>&"'`]/g, '').replace(/\s+/g, ' ').trim().slice(0, 16);
  return s || fallback;
}

function sanitizeSeat(s: unknown): SeatReq | null {
  if (!s || typeof s !== 'object') return null;
  const o = s as Record<string, unknown>;
  const pref = o.pref === 'tofu' || o.pref === 'human' ? o.pref : 'any';
  const device = o.device === 'touch' || o.device === 'gamepad' ? o.device : 'keyboard';
  const avatar = isNum(o.avatar) ? Math.max(0, Math.min(3, Math.floor(o.avatar))) : 0;
  return { name: sanitizeName(o.name), avatar, pref, device };
}

/** Parses and validates a client message. Returns null if malformed. */
export function parseClientMsg(raw: string): ClientMsg | null {
  if (raw.length > 32000) return null;
  let o: Record<string, unknown>;
  try {
    o = JSON.parse(raw);
  } catch {
    return null;
  }
  if (!o || typeof o !== 'object' || typeof o.t !== 'string') return null;
  switch (o.t) {
    case 'hello': {
      if (o.v !== PROTOCOL_VERSION || typeof o.clientId !== 'string' || !/^[a-zA-Z0-9_-]{4,40}$/.test(o.clientId)) return null;
      const seats = Array.isArray(o.seats) ? o.seats.slice(0, MAX_SEATS_PER_CLIENT).map(sanitizeSeat).filter((x): x is SeatReq => !!x) : [];
      return { t: 'hello', v: PROTOCOL_VERSION, clientId: o.clientId, seats };
    }
    case 'seat': {
      if (!isNum(o.seat)) return null;
      const m: ClientMsg = { t: 'seat', seat: Math.floor(o.seat) };
      if (o.name !== undefined) m.name = sanitizeName(o.name);
      if (isNum(o.avatar)) m.avatar = Math.max(0, Math.min(3, Math.floor(o.avatar)));
      if (o.pref === 'tofu' || o.pref === 'human' || o.pref === 'any') m.pref = o.pref;
      return m;
    }
    case 'add_seat': {
      const s = sanitizeSeat(o.seat);
      return s ? { t: 'add_seat', seat: s } : null;
    }
    case 'remove_seat':
      return isNum(o.seat) ? { t: 'remove_seat', seat: Math.floor(o.seat) } : null;
    case 'ready':
      return { t: 'ready', ready: o.ready === true };
    case 'settings': {
      const s = (o.settings ?? {}) as Record<string, unknown>;
      const out: Partial<LobbySettings> = {};
      if (isNum(s.duration)) out.duration = Math.max(60, Math.min(900, Math.round(s.duration)));
      if (typeof s.fillAI === 'boolean') out.fillAI = s.fillAI;
      if (isNum(s.difficulty)) out.difficulty = Math.max(0, Math.min(2, Math.round(s.difficulty)));
      return { t: 'settings', settings: out };
    }
    case 'assign':
      if (typeof o.key !== 'string' || (o.role !== 'tofu' && o.role !== 'human')) return null;
      return { t: 'assign', key: o.key.slice(0, 64), role: o.role };
    case 'start':
      return { t: 'start' };
    case 'in': {
      if (!Array.isArray(o.f) || o.f.length > 64) return null;
      const f: [number, number, number, number, number][] = [];
      for (const e of o.f) {
        if (!Array.isArray(e) || e.length < 5) return null;
        const [seat, seq, mx, mz, b] = e;
        if (!isNum(seat) || !isNum(seq) || !isNum(mx) || !isNum(mz) || !isNum(b)) return null;
        let x = Math.max(-1, Math.min(1, mx));
        let z = Math.max(-1, Math.min(1, mz));
        const l = Math.hypot(x, z);
        if (l > 1) {
          x /= l;
          z /= l;
        }
        f.push([Math.floor(seat), Math.floor(seq), x, z, Math.floor(b) & BTN_ALL]);
      }
      return { t: 'in', f };
    }
    case 'rematch':
      return { t: 'rematch', rotate: o.rotate === true };
    case 'to_lobby':
      return { t: 'to_lobby' };
    case 'ping':
      return isNum(o.c) ? { t: 'ping', c: o.c } : null;
    default:
      return null;
  }
}
