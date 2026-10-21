// One LAN room: lobby (players, roles, settings), authoritative 60 Hz game
// loop, delta snapshots at 20 Hz, AI takeover on disconnect, rematch.
import type { WebSocket } from 'ws';
import { randomBytes } from 'node:crypto';
import { AIController, createAI } from '../src/shared/ai/ai';
import { COUNTDOWN_TIME, DEFAULT_DURATION, SIM_DT } from '../src/shared/constants';
import { Game } from '../src/shared/sim/game';
import type { GameConfig, GameEvent, InputFrame, PlayerSlot } from '../src/shared/sim/types';
import {
  LobbyPlayer, LobbySettings, MAX_PLAYERS, MAX_SEATS_PER_CLIENT, PROTOCOL_VERSION, SNAPSHOT_EVERY, SeatReq, ServerMsg,
  parseClientMsg,
} from '../src/shared/net/protocol';
import { SnapshotEncoder } from '../src/shared/net/snapshot';
import { lanAddresses } from './net-util';

const HUMAN_NAMES = ['Maman', 'Papa', 'Léa', 'Hugo'];
/** Time for the role cards shown by clients before the 3-2-1 countdown. */
const INTRO_TIME = 4;

/** Rounds floats in snapshots (millimetres are plenty) to keep messages small. */
const round = (_k: string, v: unknown) => (typeof v === 'number' && !Number.isInteger(v) ? Math.round(v * 1000) / 1000 : v);

interface Client {
  id: string;
  ws: WebSocket | null;
  seats: SeatReq[];
  ready: boolean;
  addr: string;
  msgs: number;
  window: number;
  lastSeen: number;
}

type Frame = [number, number, number, number]; // seq, mx, mz, buttons

export interface RoomOptions {
  port?: number;
  log?: (s: string) => void;
  /** Countdown override in seconds (tests). */
  countdown?: number;
}

/** Connections beyond this are refused (players + spectators). */
const MAX_CLIENTS = 12;

export class Room {
  clients = new Map<string, Client>();
  order: string[] = [];
  hostId = '';
  settings: LobbySettings = { duration: DEFAULT_DURATION, fillAI: true, difficulty: 1, variant: 'ete' };
  private assigned = new Map<string, 'tofu' | 'human'>();
  phase: 'lobby' | 'game' = 'lobby';
  game: Game | null = null;
  private cfg: GameConfig | null = null;
  private ais = new Map<number, AIController>();
  private seatChar = new Map<string, number>();
  private inputQ = new Map<string, Frame[]>();
  private lastInput = new Map<string, InputFrame>();
  private lastSeq = new Map<string, number>();
  private encoder = new SnapshotEncoder();
  private pending: GameEvent[] = [];
  private timer: ReturnType<typeof setInterval> | null = null;
  private acc = 0;
  private lastT = 0;
  private emptySince = 0;

  constructor(readonly opts: RoomOptions = {}) {}

  private log(s: string) {
    this.opts.log?.(s);
  }

  // ------------------------------------------------------------ connections

  connect(ws: WebSocket, addr: string): void {
    let client: Client | null = null;
    const helloTimer = setTimeout(() => {
      if (!client) ws.close(4000, 'hello timeout');
    }, 8000);
    ws.on('message', (data, isBinary) => {
      if (isBinary) return;
      const raw = data.toString();
      const msg = parseClientMsg(raw);
      if (!msg) {
        if (!client && /^\s*\{\s*"t"\s*:\s*"hello"/.test(raw)) {
          // Old or newer client: tell the player instead of timing out.
          ws.send(JSON.stringify({ t: 'error', msg: 'Version du jeu différente : rechargez la page.' } satisfies ServerMsg));
          ws.close(4004, 'version');
        }
        return;
      }
      if (!client) {
        if (msg.t !== 'hello') return;
        clearTimeout(helloTimer);
        if (!this.clients.has(msg.clientId) && this.clients.size >= MAX_CLIENTS) {
          ws.send(JSON.stringify({ t: 'error', msg: 'Le salon est complet.' } satisfies ServerMsg));
          ws.close(4004, 'full');
          return;
        }
        client = this.hello(ws, addr, msg.clientId, msg.seats);
        return;
      }
      // Rate limiting.
      const now = Date.now();
      if (now - client.window > 1000) {
        client.window = now;
        client.msgs = 0;
      }
      if (++client.msgs > 600) {
        if (client.msgs > 3000) ws.close(4001, 'flood');
        return;
      }
      client.lastSeen = now;
      this.onMessage(client, msg);
    });
    ws.on('close', () => {
      clearTimeout(helloTimer);
      if (client && client.ws === ws) this.disconnect(client);
    });
    ws.on('error', () => undefined);
  }

  private send(c: Client, msg: ServerMsg | string) {
    if (!c.ws || c.ws.readyState !== 1) return;
    if (c.ws.bufferedAmount > 4_000_000) {
      c.ws.close(4002, 'too slow');
      return;
    }
    c.ws.send(typeof msg === 'string' ? msg : JSON.stringify(msg));
  }

  private hello(ws: WebSocket, addr: string, clientId: string, seats: SeatReq[]): Client {
    let c = this.clients.get(clientId);
    if (c) {
      // Reconnection: take over the previous connection.
      if (c.ws && c.ws !== ws) c.ws.close(4003, 'replaced');
      c.ws = ws;
      c.addr = addr;
      this.log(`reconnect ${clientId}`);
    } else {
      const total = this.totalSeats();
      const allowed = Math.max(0, MAX_PLAYERS + 2 - total);
      c = { id: clientId, ws, seats: seats.slice(0, Math.min(MAX_SEATS_PER_CLIENT, Math.max(1, allowed))), ready: false, addr, msgs: 0, window: Date.now(), lastSeen: Date.now() };
      if (!c.seats.length) c.seats.push({ name: 'Joueur', avatar: 0, pref: 'any', device: 'keyboard' });
      this.clients.set(clientId, c);
      this.order.push(clientId);
      this.log(`join ${clientId} from ${addr}`);
    }
    if (!this.hostId || !this.clients.get(this.hostId)?.ws) this.hostId = this.pickHost(clientId);
    this.send(c, { t: 'welcome', clientId, host: this.hostId === clientId, lanUrls: lanAddresses().map((ip) => `http://${ip}:${this.opts.port ?? 8080}/`) });
    if (this.phase === 'game' && this.game) {
      // Rejoin a running match: give control back to the player.
      this.reattach(c);
    }
    this.broadcastLobby();
    return c;
  }

  /** Prefer a client on the host machine as host. */
  private pickHost(fallback: string): string {
    for (const id of this.order) {
      const c = this.clients.get(id);
      if (c?.ws && /^(::1|127\.|::ffff:127\.)/.test(c.addr)) return id;
    }
    for (const id of this.order) if (this.clients.get(id)?.ws) return id;
    return fallback;
  }

  private disconnect(c: Client) {
    c.ws = null;
    this.log(`leave ${c.id}`);
    if (this.phase === 'game' && this.game) {
      // AI takes over so the match keeps going.
      c.seats.forEach((_, i) => {
        const id = this.seatChar.get(`${c.id}:${i}`);
        if (id === undefined || !this.game) return;
        this.game.state.chars[id].ai = true;
        this.ais.set(id, createAI(this.game, id, this.settings.difficulty));
      });
    } else {
      // In the lobby, forget clients that left.
      this.clients.delete(c.id);
      this.order = this.order.filter((x) => x !== c.id);
    }
    if (this.hostId === c.id) this.hostId = this.pickHost('');
    this.broadcastLobby();
    if (![...this.clients.values()].some((x) => x.ws)) this.emptySince = Date.now();
  }

  private reattach(c: Client) {
    if (!this.game || !this.cfg) return;
    const you: { seat: number; charId: number }[] = [];
    c.seats.forEach((_, i) => {
      const id = this.seatChar.get(`${c.id}:${i}`);
      if (id === undefined) return;
      you.push({ seat: i, charId: id });
      this.game!.state.chars[id].ai = false;
      this.ais.delete(id);
      // The new client session numbers its inputs from 1 again.
      const key = `${c.id}:${i}`;
      this.lastSeq.delete(key);
      this.acked.delete(key);
      this.inputQ.delete(key);
      this.lastInput.delete(key);
    });
    this.send(c, JSON.stringify({ t: 'start', cfg: this.cfg, you, state: this.game.state }, round));
  }

  private totalSeats(): number {
    let n = 0;
    for (const c of this.clients.values()) n += c.seats.length;
    return n;
  }

  // ------------------------------------------------------------ messages

  private onMessage(c: Client, msg: NonNullable<ReturnType<typeof parseClientMsg>>) {
    const isHost = c.id === this.hostId;
    switch (msg.t) {
      case 'seat': {
        const s = c.seats[msg.seat];
        if (!s) return;
        if (msg.name !== undefined) s.name = msg.name;
        if (msg.avatar !== undefined) s.avatar = msg.avatar;
        if (msg.pref !== undefined) {
          s.pref = msg.pref;
          this.assigned.delete(`${c.id}:${msg.seat}`);
        }
        this.broadcastLobby();
        return;
      }
      case 'add_seat':
        if (this.phase !== 'lobby' || c.seats.length >= MAX_SEATS_PER_CLIENT || this.totalSeats() >= MAX_PLAYERS + 2) return;
        c.seats.push(msg.seat);
        this.broadcastLobby();
        return;
      case 'remove_seat':
        if (this.phase !== 'lobby' || msg.seat <= 0 || msg.seat >= c.seats.length) return;
        c.seats.splice(msg.seat, 1);
        this.broadcastLobby();
        return;
      case 'ready':
        c.ready = msg.ready;
        this.broadcastLobby();
        return;
      case 'settings':
        if (!isHost) return;
        Object.assign(this.settings, msg.settings);
        this.broadcastLobby();
        return;
      case 'assign':
        if (!isHost) return;
        if (msg.role === 'tofu') for (const [k, v] of this.assigned) if (v === 'tofu') this.assigned.delete(k);
        this.assigned.set(msg.key, msg.role);
        this.broadcastLobby();
        return;
      case 'start':
        if (!isHost || this.phase !== 'lobby') return;
        this.startGame(false);
        return;
      case 'rematch':
        if (!isHost || this.phase !== 'game') return;
        this.startGame(msg.rotate);
        return;
      case 'to_lobby':
        if (!isHost || this.phase !== 'game') return;
        this.stopGame();
        for (const x of this.clients.values()) x.ready = false;
        this.dropDisconnected();
        this.broadcastLobby();
        return;
      case 'in': {
        if (this.phase !== 'game') return;
        for (const [seat, seq, mx, mz, b] of msg.f) {
          const key = `${c.id}:${seat}`;
          if (!this.seatChar.has(key)) continue;
          const last = this.lastSeq.get(key) ?? 0;
          if (seq <= last) continue;
          this.lastSeq.set(key, seq);
          let q = this.inputQ.get(key);
          if (!q) this.inputQ.set(key, (q = []));
          q.push([seq, mx, mz, b]);
          // Keep latency bounded: merge the oldest frames, preserving button presses.
          while (q.length > 8) {
            const a = q.shift()!;
            q[0][3] |= a[3];
          }
        }
        return;
      }
      case 'ping':
        this.send(c, { t: 'pong', c: msg.c, s: Date.now() });
        return;
      case 'hello':
        return;
    }
  }

  // ------------------------------------------------------------ lobby

  /** Resolves roles: one Tofu, up to two humans, extra players wait. */
  lobbyPlayers(): LobbyPlayer[] {
    const list: LobbyPlayer[] = [];
    for (const id of this.order) {
      const c = this.clients.get(id);
      if (!c) continue;
      c.seats.forEach((s, i) => list.push({
        key: `${id}:${i}`, clientId: id, seat: i, name: s.name, avatar: s.avatar, pref: s.pref, role: 'wait',
        ready: c.ready, connected: !!c.ws, device: s.device,
      }));
    }
    // Same first name twice: number them so everybody knows who is who.
    const seen = new Map<string, number>();
    for (const p of list) {
      const k = p.name.toLowerCase();
      const n = (seen.get(k) ?? 0) + 1;
      seen.set(k, n);
      if (n > 1) p.name = `${p.name.slice(0, 13)} ${n}`;
    }
    const active = list.slice(0, MAX_PLAYERS);
    const free = (p: LobbyPlayer) => this.assigned.get(p.key) !== 'human';
    // Host choice, then "Tofu" wishes, then "any". If everybody wants to be
    // human, the computer plays Tofu (fillAI) or the first player does.
    let tofu = active.find((p) => this.assigned.get(p.key) === 'tofu');
    if (!tofu) tofu = active.find((p) => p.pref === 'tofu' && free(p));
    if (!tofu) tofu = active.find((p) => p.pref === 'any' && free(p));
    if (!tofu && !this.settings.fillAI) tofu = active.find(free) ?? active[0];
    let humans = 0;
    for (const p of active) {
      if (p === tofu) p.role = 'tofu';
      else if (humans < 2) {
        p.role = 'human';
        humans++;
      }
    }
    return list;
  }

  broadcastLobby() {
    const players = this.lobbyPlayers();
    const hasTofu = players.some((p) => p.role === 'tofu');
    const humans = players.filter((p) => p.role === 'human').length;
    const msg: ServerMsg = {
      t: 'lobby', players, settings: this.settings, hostId: this.hostId, phase: this.phase,
      ai: { tofu: !hasTofu, humans: humans === 0 ? 1 : 0 },
    };
    const s = JSON.stringify(msg);
    for (const c of this.clients.values()) this.send(c, s);
  }

  // ------------------------------------------------------------ game

  private startGame(rotate: boolean): void {
    const lobby = this.lobbyPlayers().filter((p) => p.role !== 'wait' && p.connected);
    if (rotate && this.cfg) {
      // Next player in the list becomes Tofu.
      const curTofu = lobby.findIndex((p) => p.role === 'tofu');
      if (lobby.length > 1 && curTofu >= 0) {
        const next = lobby[(curTofu + 1) % lobby.length];
        for (const [k, v] of this.assigned) if (v === 'tofu') this.assigned.delete(k);
        this.assigned.set(lobby[curTofu].key, 'human');
        this.assigned.set(next.key, 'tofu');
        this.startGame(false);
        return;
      }
    }
    const players: PlayerSlot[] = [];
    const mapping: { key: string; charId: number }[] = [];
    const tofuP = lobby.find((p) => p.role === 'tofu');
    players.push({ role: 'tofu', name: tofuP ? tofuP.name : 'Tofu', avatar: tofuP?.avatar ?? 0, ai: !tofuP });
    if (tofuP) mapping.push({ key: tofuP.key, charId: 0 });
    const humansP = lobby.filter((p) => p.role === 'human');
    for (const h of humansP) {
      mapping.push({ key: h.key, charId: players.length });
      players.push({ role: 'human', name: h.name, avatar: h.avatar, ai: false });
    }
    if (!humansP.length) players.push({ role: 'human', name: HUMAN_NAMES[0], avatar: 0, ai: true });
    if (!tofuP && !humansP.length) return;
    this.cfg = {
      seed: randomBytes(4).readUInt32LE(0), duration: this.settings.duration, players, difficulty: this.settings.difficulty,
      countdown: this.opts.countdown ?? COUNTDOWN_TIME + INTRO_TIME, variant: this.settings.variant,
    };
    this.game = new Game(this.cfg);
    this.ais.clear();
    for (const ch of this.game.state.chars) if (ch.ai) this.ais.set(ch.id, createAI(this.game, ch.id, this.settings.difficulty));
    this.seatChar.clear();
    this.inputQ.clear();
    this.lastInput.clear();
    this.lastSeq.clear();
    this.acked.clear();
    for (const m of mapping) this.seatChar.set(m.key, m.charId);
    this.encoder = new SnapshotEncoder();
    this.encoder.resetTo(this.game.state);
    this.pending = [];
    this.phase = 'game';
    const full = JSON.stringify(this.game.state, round);
    for (const c of this.clients.values()) {
      const you: { seat: number; charId: number }[] = [];
      c.seats.forEach((_, i) => {
        const id = this.seatChar.get(`${c.id}:${i}`);
        if (id !== undefined) you.push({ seat: i, charId: id });
      });
      this.send(c, `{"t":"start","cfg":${JSON.stringify(this.cfg)},"you":${JSON.stringify(you)},"state":${full}}`);
    }
    for (const c of this.clients.values()) c.ready = false;
    this.broadcastLobby();
    this.log(`start: ${players.map((p) => `${p.role}${p.ai ? '(IA)' : ''}`).join(', ')}`);
    if (!this.timer) {
      this.lastT = performance.now();
      this.acc = 0;
      this.timer = setInterval(() => this.loop(), 1000 / 120);
    }
  }

  /** Forgets clients that left during a match (back in the lobby). */
  private dropDisconnected() {
    for (const [id, c] of this.clients) {
      if (c.ws) continue;
      this.clients.delete(id);
      this.order = this.order.filter((x) => x !== id);
    }
  }

  private stopGame() {
    this.phase = 'lobby';
    this.game = null;
    this.ais.clear();
    this.seatChar.clear();
    if (this.timer) clearInterval(this.timer);
    this.timer = null;
  }

  private loop() {
    const now = performance.now();
    this.acc += Math.min(0.25, (now - this.lastT) / 1000);
    this.lastT = now;
    let steps = 0;
    while (this.acc >= SIM_DT && steps < 8) {
      this.step();
      this.acc -= SIM_DT;
      steps++;
    }
    // Nobody connected for a while: back to the lobby.
    if (this.emptySince && ![...this.clients.values()].some((c) => c.ws) && Date.now() - this.emptySince > 60000) {
      this.stopGame();
      this.clients.clear();
      this.order = [];
      this.hostId = '';
      this.emptySince = 0;
    }
  }

  /** One authoritative simulation tick. */
  step() {
    const g = this.game;
    if (!g) return;
    const inputs: (InputFrame | undefined)[] = [];
    const acks = new Map<string, number>();
    for (const [key, id] of this.seatChar) {
      if (g.state.chars[id].ai) continue;
      const q = this.inputQ.get(key);
      const f = q?.shift();
      if (f) {
        const inp = { mx: f[1], mz: f[2], buttons: f[3] };
        this.lastInput.set(key, inp);
        acks.set(key, f[0]);
        inputs[id] = inp;
      } else {
        // No fresh input: keep the last one (smooth over jitter).
        inputs[id] = this.lastInput.get(key);
      }
    }
    for (const [id, ai] of this.ais) inputs[id] = ai.think();
    g.step(inputs);
    for (const e of g.drainEvents()) this.pending.push(e);
    for (const [k, seq] of acks) this.acked.set(k, seq);
    if (g.state.tick % SNAPSHOT_EVERY === 0) this.broadcastSnap();
  }

  private acked = new Map<string, number>();

  private broadcastSnap() {
    const g = this.game;
    if (!g) return;
    const snap = this.encoder.delta(g.state, this.pending);
    this.pending = [];
    const body = JSON.stringify(snap, round);
    for (const c of this.clients.values()) {
      if (!c.ws) continue;
      const ack: Record<number, number> = {};
      c.seats.forEach((_, i) => {
        const v = this.acked.get(`${c.id}:${i}`);
        if (v !== undefined) ack[i] = v;
      });
      this.send(c, `{"t":"snap","ack":${JSON.stringify(ack)},"d":${body}}`);
    }
  }

  close() {
    this.stopGame();
    for (const c of this.clients.values()) c.ws?.close();
  }
}

export { PROTOCOL_VERSION };
