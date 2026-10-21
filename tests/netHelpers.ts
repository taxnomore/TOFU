// Helpers for the network tests: a scripted client and a real game server.
import http from 'node:http';
import type { AddressInfo } from 'node:net';
import { WebSocket, WebSocketServer } from 'ws';
import { ManagerOptions, RoomManager } from '../server/rooms';
import { LobbyPlayer, PROTOCOL_VERSION, SeatReq, ServerMsg } from '../src/shared/net/protocol';
import { applySnap } from '../src/shared/net/snapshot';
import type { GameState } from '../src/shared/sim/types';

export type Lobby = Extract<ServerMsg, { t: 'lobby' }>;
export type Start = Extract<ServerMsg, { t: 'start' }>;
export type Welcome = Extract<ServerMsg, { t: 'welcome' }>;

export const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

export async function until<T>(f: () => T | undefined | null | false, ms = 4000, what = 'condition'): Promise<T> {
  const t0 = Date.now();
  for (;;) {
    const v = f();
    if (v) return v;
    if (Date.now() - t0 > ms) throw new Error(`timeout waiting for ${what}`);
    await sleep(10);
  }
}

export class TestClient {
  ws!: WebSocket;
  welcome: Welcome | null = null;
  lobby: Lobby | null = null;
  start: Start | null = null;
  starts = 0;
  state: GameState | null = null;
  ack: Record<number, number> = {};
  snaps = 0;
  errors: string[] = [];
  closedCode = 0;
  seq = 0;

  constructor(readonly url: string, readonly id: string, readonly seats: SeatReq[], readonly headers: Record<string, string> = {}) {}

  async open() {
    this.ws = new WebSocket(this.url, { headers: this.headers });
    this.closedCode = 0;
    this.ws.on('message', (data) => this.onMessage(JSON.parse(data.toString()) as ServerMsg));
    this.ws.on('close', (code) => (this.closedCode = code));
    await new Promise<void>((res, rej) => {
      this.ws.once('open', () => res());
      this.ws.once('error', rej);
    });
    this.send({ t: 'hello', v: PROTOCOL_VERSION, clientId: this.id, seats: this.seats });
  }

  private onMessage(m: ServerMsg) {
    if (m.t === 'welcome') this.welcome = m;
    else if (m.t === 'lobby') this.lobby = m;
    else if (m.t === 'start') {
      this.start = m;
      this.starts++;
      this.state = m.state;
      this.ack = {};
      this.seq = 0;
    } else if (m.t === 'snap' && this.state) {
      applySnap(this.state, m.d);
      this.ack = m.ack;
      this.snaps++;
    } else if (m.t === 'error') this.errors.push(m.msg);
  }

  send(m: unknown) {
    this.ws.send(typeof m === 'string' ? m : JSON.stringify(m));
  }

  /** Sends n input frames in real time (one 60 Hz tick each). */
  async drive(n: number, mx: number, mz: number, buttons = 0) {
    for (let i = 0; i < n; i += 2) {
      this.send({ t: 'in', f: [[0, ++this.seq, mx, mz, buttons], [0, ++this.seq, mx, mz, buttons]] });
      await sleep(33);
    }
  }

  me(): LobbyPlayer | undefined {
    return this.lobby?.players.find((p) => p.clientId === this.id);
  }

  close() {
    this.ws.close();
  }
}

export const seat = (name: string, pref: SeatReq['pref']): SeatReq => ({ name, avatar: 0, pref, device: 'keyboard' });

/** A real HTTP + WebSocket game server on a free port. */
export async function startServer(opts: ManagerOptions) {
  const manager = new RoomManager(opts);
  const server = http.createServer();
  const wss = new WebSocketServer({ noServer: true, maxPayload: 64 * 1024 });
  manager.attach(server, wss);
  await new Promise<void>((r) => server.listen(0, '127.0.0.1', () => r()));
  const port = (server.address() as AddressInfo).port;
  return {
    manager,
    port,
    url: (room = '') => `ws://127.0.0.1:${port}/ws${room ? `?salon=${room}` : ''}`,
    async close() {
      manager.close();
      for (const c of wss.clients) c.terminate();
      await new Promise((r) => server.close(r));
    },
  };
}
