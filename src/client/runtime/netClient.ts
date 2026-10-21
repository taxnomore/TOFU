// WebSocket link to the game server (home network or Internet): hello,
// automatic reconnection with the same client id, ping, and dispatch of
// server messages.
import { CLOSE_FINAL, ClientMsg, PROTOCOL_VERSION, SeatReq, ServerMode, ServerMsg } from '../../shared/net/protocol';

export type LobbyMsg = Extract<ServerMsg, { t: 'lobby' }>;
export type StartMsg = Extract<ServerMsg, { t: 'start' }>;
export type SnapMsg = Extract<ServerMsg, { t: 'snap' }>;
export type WelcomeMsg = Extract<ServerMsg, { t: 'welcome' }>;
/** connecting: first attempt · open: connected · lost: retrying · closed: given up or left. */
export type NetStatus = 'connecting' | 'open' | 'lost' | 'closed';

function randomId(): string {
  const a = new Uint8Array(12);
  crypto.getRandomValues(a);
  return [...a].map((b) => b.toString(36).padStart(2, '0')).join('').slice(0, 20);
}

/** Per-tab client id, kept across page reloads so a player gets their seat back. */
export function tabClientId(): string {
  try {
    let id = sessionStorage.getItem('tofu.clientId');
    if (!id) {
      id = randomId();
      sessionStorage.setItem('tofu.clientId', id);
    }
    return id;
  } catch {
    return randomId();
  }
}

/** WebSocket address of this page's server; `room` is a code, or "new" to create a room. */
export function serverUrl(room = ''): string {
  return `${location.protocol === 'https:' ? 'wss' : 'ws'}://${location.host}/ws${room ? `?salon=${encodeURIComponent(room)}` : ''}`;
}

export function defaultServerUrl(): string {
  return serverUrl();
}

export class NetClient {
  readonly clientId = tabClientId();
  status: NetStatus = 'connecting';
  host = false;
  lanUrls: string[] = [];
  mode: ServerMode = 'lan';
  /** Code of the room on an Internet server. */
  room = '';
  publicUrl = '';
  lobby: LobbyMsg | null = null;
  /** Smoothed round-trip time in ms. */
  rtt = 0;
  error = '';
  /** Number of failed attempts since the last successful connection. */
  failures = 0;
  onLobby: ((m: LobbyMsg) => void) | null = null;
  onStart: ((m: StartMsg) => void) | null = null;
  onSnap: ((m: SnapMsg) => void) | null = null;
  onStatus: ((s: NetStatus) => void) | null = null;
  onWelcome: ((m: WelcomeMsg) => void) | null = null;
  private ws: WebSocket | null = null;
  private left = false;
  private lastMsgAt = 0;
  private retryTimer: ReturnType<typeof setTimeout> | null = null;
  private pingTimer: ReturnType<typeof setInterval> | null = null;

  constructor(public seats: SeatReq[], private url = defaultServerUrl()) {}

  connect(): void {
    this.left = false;
    let ws: WebSocket;
    try {
      ws = new WebSocket(this.url);
    } catch {
      this.retry();
      return;
    }
    this.ws = ws;
    ws.onopen = () => {
      this.failures = 0;
      this.lastMsgAt = performance.now();
      this.error = '';
      ws.send(JSON.stringify({ t: 'hello', v: PROTOCOL_VERSION, clientId: this.clientId, seats: this.seats } satisfies ClientMsg));
      this.setStatus('open');
      this.ping();
    };
    ws.onmessage = (e) => {
      this.lastMsgAt = performance.now();
      if (typeof e.data === 'string') this.receive(e.data);
    };
    ws.onclose = (e) => {
      if (this.ws !== ws) return;
      this.ws = null;
      if (this.left) return;
      if (e.code === 4003) {
        this.error = 'Cette partie a été ouverte dans un autre onglet.';
        this.left = true;
        this.setStatus('closed');
        return;
      }
      if (e.code >= CLOSE_FINAL.version && e.code < 4100) {
        // Refused (version, room unknown or full, sent away): the server said why.
        this.left = true;
        this.setStatus('closed');
        return;
      }
      this.retry();
    };
    ws.onerror = () => undefined;
    if (!this.pingTimer) this.pingTimer = setInterval(() => this.ping(), 2000);
  }

  private retry() {
    this.failures++;
    this.setStatus(this.failures === 1 && this.status === 'connecting' ? 'connecting' : 'lost');
    if (this.retryTimer) clearTimeout(this.retryTimer);
    const delay = Math.min(3000, 400 * this.failures);
    this.retryTimer = setTimeout(() => {
      this.retryTimer = null;
      if (!this.left) this.connect();
    }, delay);
  }

  private setStatus(s: NetStatus) {
    if (this.status === s) return;
    this.status = s;
    this.onStatus?.(s);
  }

  get connected(): boolean {
    return this.status === 'open';
  }

  send(msg: ClientMsg): void {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) this.ws.send(JSON.stringify(msg));
  }

  private ping() {
    // The server answers every ping: silence means a dead Wi-Fi link.
    if (this.status === 'open' && performance.now() - this.lastMsgAt > 7000) {
      this.reconnect();
      return;
    }
    this.send({ t: 'ping', c: performance.now() });
  }

  /** Drops the current socket and opens a new one (same client id). */
  reconnect(): void {
    const old = this.ws;
    this.ws = null;
    if (old) {
      old.onclose = null;
      old.onmessage = null;
      try {
        old.close();
      } catch {
        /* already closed */
      }
    }
    if (!this.left) this.retry();
  }

  private receive(raw: string) {
    let m: ServerMsg;
    try {
      m = JSON.parse(raw);
    } catch {
      return;
    }
    switch (m.t) {
      case 'welcome':
        this.host = m.host;
        this.lanUrls = m.lanUrls;
        this.mode = m.mode;
        this.room = m.room;
        this.publicUrl = m.publicUrl;
        // Reconnections go back to this room, not to a new one.
        if (m.room) this.url = `${this.url.replace(/\?.*$/, '')}?salon=${m.room}`;
        this.onWelcome?.(m);
        break;
      case 'lobby':
        this.lobby = m;
        this.host = m.hostId === this.clientId;
        this.onLobby?.(m);
        break;
      case 'start':
        this.onStart?.(m);
        break;
      case 'snap':
        this.onSnap?.(m);
        break;
      case 'pong': {
        const r = performance.now() - m.c;
        this.rtt = this.rtt ? this.rtt * 0.8 + r * 0.2 : r;
        break;
      }
      case 'error':
        this.error = m.msg;
        this.onStatus?.(this.status);
        break;
    }
  }

  /** Leaves the room for good (no reconnection). */
  close(): void {
    this.left = true;
    if (this.retryTimer) clearTimeout(this.retryTimer);
    if (this.pingTimer) clearInterval(this.pingTimer);
    this.retryTimer = null;
    this.pingTimer = null;
    const ws = this.ws;
    this.ws = null;
    ws?.close(1000, 'bye');
    this.setStatus('closed');
  }
}
