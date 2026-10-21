// Rooms of one server. At home there is a single room that every device
// joins. On the Internet, each family creates its own room and shares its
// code; limits keep one visitor from using up the server, and empty or idle
// rooms disappear on their own.
import type http from 'node:http';
import type { Duplex } from 'node:stream';
import { randomInt } from 'node:crypto';
import type { WebSocket, WebSocketServer } from 'ws';
import { CLOSE_FINAL, ROOM_CODE_LENGTH, ROOM_LETTERS, ServerMode, ServerMsg, normalizeRoomCode } from '../src/shared/net/protocol';
import { Room, RoomOptions } from './room';

export interface Limits {
  /** Rooms at the same time. */
  maxRooms: number;
  /** Matches running at the same time (each one costs about 1 % of a CPU core). */
  maxGames: number;
  /** Open connections in total. */
  maxConnections: number;
  /** Open connections from one address (a family behind one box shares it). */
  maxPerIp: number;
  /** Rooms one address may create in 10 minutes. */
  roomsPerIp: number;
  /** Wrong codes one address may try in 10 minutes. */
  badCodesPerIp: number;
  /** An empty room disappears after this time (ms). */
  emptyRoomTtl: number;
  /** A lobby where nobody does anything closes after this time (ms). */
  idleLobbyTtl: number;
}

export const DEFAULT_LIMITS: Limits = {
  maxRooms: 100, maxGames: 40, maxConnections: 600, maxPerIp: 16, roomsPerIp: 5, badCodesPerIp: 20,
  emptyRoomTtl: 2 * 60_000, idleLobbyTtl: 30 * 60_000,
};

const WINDOW = 10 * 60_000;

export interface ManagerOptions {
  mode: ServerMode;
  port?: number;
  publicUrl?: string;
  /** Behind a reverse proxy or tunnel: read the visitor's address from its headers. */
  trustProxy?: boolean;
  limits?: Partial<Limits>;
  log?: (s: string) => void;
  /** Options given to every room (tests: shorter countdown). */
  room?: Partial<RoomOptions>;
}

export class RoomManager {
  readonly rooms = new Map<string, Room>();
  readonly limits: Limits;
  /** The single room of the home network. */
  private lanRoom: Room | null = null;
  private conns = new Map<string, number>();
  private total = 0;
  private created = new Map<string, number[]>();
  private badCodes = new Map<string, number[]>();
  private sweeper: ReturnType<typeof setInterval> | null = null;

  constructor(readonly opts: ManagerOptions) {
    this.limits = { ...DEFAULT_LIMITS };
    for (const [k, v] of Object.entries(opts.limits ?? {})) if (typeof v === 'number') this.limits[k as keyof Limits] = v;
    if (opts.mode === 'lan') this.lanRoom = this.makeRoom('');
    else {
      this.sweeper = setInterval(() => this.sweep(), 15_000);
      this.sweeper.unref?.();
    }
  }

  private log(s: string) {
    this.opts.log?.(s);
  }

  private makeRoom(code: string): Room {
    return new Room({
      ...this.opts.room,
      port: this.opts.port,
      mode: this.opts.mode,
      code,
      publicUrl: this.opts.publicUrl,
      log: (s) => this.log(code ? `${code} ${s}` : s),
      canStart: () => this.gamesRunning() < this.limits.maxGames,
    });
  }

  gamesRunning(): number {
    let n = 0;
    for (const r of this.all()) if (r.phase === 'game') n++;
    return n;
  }

  private all(): Room[] {
    return this.lanRoom ? [this.lanRoom] : [...this.rooms.values()];
  }

  /** Address of the visitor (the proxy's own address means nothing). */
  clientIp(req: http.IncomingMessage): string {
    if (this.opts.trustProxy) {
      const cf = req.headers['cf-connecting-ip'];
      if (typeof cf === 'string' && cf) return cf.trim();
      const xff = req.headers['x-forwarded-for'];
      const first = (Array.isArray(xff) ? xff[0] : xff)?.split(',')[0]?.trim();
      if (first) return first;
    }
    return req.socket.remoteAddress ?? '';
  }

  /** Counts recent events of one address in a 10-minute window. */
  private recent(map: Map<string, number[]>, ip: string, now: number, add: boolean): number {
    const list = (map.get(ip) ?? []).filter((t) => now - t < WINDOW);
    if (add) list.push(now);
    if (list.length) map.set(ip, list);
    else map.delete(ip);
    return list.length;
  }

  private newCode(): string {
    for (;;) {
      let c = '';
      for (let i = 0; i < ROOM_CODE_LENGTH; i++) c += ROOM_LETTERS[randomInt(ROOM_LETTERS.length)];
      if (!this.rooms.has(c)) return c;
    }
  }

  /**
   * Hands a new WebSocket to its room (`/ws?salon=CODE`, or `?salon=new` to
   * create one), or refuses it with a message the player can read.
   */
  connect(ws: WebSocket, req: http.IncomingMessage): void {
    const ip = this.clientIp(req);
    const now = Date.now();
    const refuse = (code: number, msg: string) => {
      ws.send(JSON.stringify({ t: 'error', msg } satisfies ServerMsg));
      ws.close(code, 'refused');
    };
    if (this.total >= this.limits.maxConnections || (this.conns.get(ip) ?? 0) >= this.limits.maxPerIp) {
      refuse(CLOSE_FINAL.busy, 'Trop de connexions en ce moment. Réessayez dans quelques minutes.');
      return;
    }
    let room = this.lanRoom;
    if (!room) {
      const want = new URL(req.url ?? '/', 'http://x').searchParams.get('salon') ?? '';
      if (want === 'new') {
        if (this.rooms.size >= this.limits.maxRooms) {
          refuse(CLOSE_FINAL.busy, 'Le serveur accueille déjà beaucoup de salons. Réessayez dans quelques minutes.');
          return;
        }
        if (this.recent(this.created, ip, now, false) >= this.limits.roomsPerIp) {
          refuse(CLOSE_FINAL.busy, 'Vous avez créé beaucoup de salons : attendez quelques minutes.');
          return;
        }
        this.recent(this.created, ip, now, true);
        const code = this.newCode();
        room = this.makeRoom(code);
        this.rooms.set(code, room);
        this.log(`salon ${code} créé (${this.rooms.size} en tout)`);
      } else {
        if (this.recent(this.badCodes, ip, now, false) >= this.limits.badCodesPerIp) {
          refuse(CLOSE_FINAL.busy, 'Trop de codes essayés : attendez quelques minutes.');
          return;
        }
        const code = normalizeRoomCode(want);
        room = code ? this.rooms.get(code) ?? null : null;
        if (!room) {
          this.recent(this.badCodes, ip, now, true);
          refuse(CLOSE_FINAL.noRoom, want ? "Ce salon n'existe pas, ou plus. Vérifiez le code." : 'Il manque le code du salon.');
          return;
        }
      }
    }
    this.total++;
    this.conns.set(ip, (this.conns.get(ip) ?? 0) + 1);
    ws.on('close', () => {
      this.total--;
      const n = (this.conns.get(ip) ?? 1) - 1;
      if (n > 0) this.conns.set(ip, n);
      else this.conns.delete(ip);
    });
    room.connect(ws, ip);
  }

  /**
   * Accepts WebSocket upgrades on `/ws`. On the Internet, a page from another
   * site may not open a connection (the Origin header must match the host).
   */
  attach(server: http.Server, wss: WebSocketServer): void {
    server.on('upgrade', (req: http.IncomingMessage, socket: Duplex, head: Buffer) => {
      const url = new URL(req.url ?? '/', 'http://x');
      if (url.pathname !== '/ws') return; // other upgrades (Vite HMR) are handled elsewhere
      if (this.opts.mode === 'internet' && !this.sameOrigin(req)) {
        socket.end('HTTP/1.1 403 Forbidden\r\n\r\n');
        return;
      }
      wss.handleUpgrade(req, socket, head, (ws) => this.connect(ws, req));
    });
  }

  private sameOrigin(req: http.IncomingMessage): boolean {
    const origin = req.headers.origin;
    if (!origin) return true; // not a browser
    try {
      const host = new URL(origin).host;
      const allowed = [req.headers.host, req.headers['x-forwarded-host']];
      if (this.opts.publicUrl) allowed.push(new URL(this.opts.publicUrl).host);
      return allowed.some((h) => typeof h === 'string' && h.toLowerCase() === host.toLowerCase());
    } catch {
      return false;
    }
  }

  /** Removes empty rooms and closes lobbies where nothing happens. */
  sweep(now = Date.now()): void {
    for (const [code, room] of this.rooms) {
      if (room.emptyFor(now) > this.limits.emptyRoomTtl) {
        room.close();
        this.rooms.delete(code);
        this.log(`salon ${code} vide, supprimé`);
      } else if (room.phase === 'lobby' && now - room.lastActivity > this.limits.idleLobbyTtl) {
        room.close(`Salon fermé après ${Math.round(this.limits.idleLobbyTtl / 60_000)} minutes sans partie. Créez-en un nouveau pour rejouer.`);
        this.rooms.delete(code);
        this.log(`salon ${code} inactif, fermé`);
      }
    }
    for (const map of [this.created, this.badCodes]) for (const ip of [...map.keys()]) this.recent(map, ip, now, false);
  }

  close(): void {
    if (this.sweeper) clearInterval(this.sweeper);
    for (const r of this.all()) r.close();
    this.rooms.clear();
  }

  /** The home room (tests and the LAN server). */
  get lan(): Room | null {
    return this.lanRoom;
  }
}
