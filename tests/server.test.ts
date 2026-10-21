// End-to-end LAN test: a real HTTP + WebSocket server, three clients, a lobby,
// a synchronized match, validation, a disconnect/reconnect and a rematch.
import http from 'node:http';
import type { AddressInfo } from 'node:net';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { WebSocket, WebSocketServer } from 'ws';
import { Room } from '../server/room';
import type { LobbyPlayer, SeatReq, ServerMsg } from '../src/shared/net/protocol';
import { applySnap } from '../src/shared/net/snapshot';
import type { GameState } from '../src/shared/sim/types';

type Lobby = Extract<ServerMsg, { t: 'lobby' }>;
type Start = Extract<ServerMsg, { t: 'start' }>;

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function until<T>(f: () => T | undefined | null | false, ms = 4000, what = 'condition'): Promise<T> {
  const t0 = Date.now();
  for (;;) {
    const v = f();
    if (v) return v;
    if (Date.now() - t0 > ms) throw new Error(`timeout waiting for ${what}`);
    await sleep(10);
  }
}

class TestClient {
  ws!: WebSocket;
  lobby: Lobby | null = null;
  start: Start | null = null;
  starts = 0;
  state: GameState | null = null;
  ack: Record<number, number> = {};
  snaps = 0;
  errors: string[] = [];
  closedCode = 0;
  seq = 0;

  constructor(readonly url: string, readonly id: string, readonly seats: SeatReq[]) {}

  async open() {
    this.ws = new WebSocket(this.url);
    this.closedCode = 0;
    this.ws.on('message', (data) => this.onMessage(JSON.parse(data.toString()) as ServerMsg));
    this.ws.on('close', (code) => (this.closedCode = code));
    await new Promise<void>((res, rej) => {
      this.ws.once('open', () => res());
      this.ws.once('error', rej);
    });
    this.send({ t: 'hello', v: 1, clientId: this.id, seats: this.seats });
  }

  private onMessage(m: ServerMsg) {
    if (m.t === 'lobby') this.lobby = m;
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

const seat = (name: string, pref: SeatReq['pref']): SeatReq => ({ name, avatar: 0, pref, device: 'keyboard' });

let server: http.Server;
let room: Room;
let url = '';

beforeAll(async () => {
  room = new Room({ countdown: 0.3 });
  server = http.createServer();
  const wss = new WebSocketServer({ server, path: '/ws', maxPayload: 64 * 1024 });
  wss.on('connection', (ws, req) => room.connect(ws, req.socket.remoteAddress ?? ''));
  await new Promise<void>((r) => server.listen(0, '127.0.0.1', () => r()));
  url = `ws://127.0.0.1:${(server.address() as AddressInfo).port}/ws`;
});

afterAll(async () => {
  room.close();
  await new Promise((r) => server.close(r));
});

describe('LAN server with three clients', () => {
  it('runs a lobby, a synchronized match, a reconnection and a rematch', async () => {
    const a = new TestClient(url, 'client-aaaa', [seat('Alice', 'tofu')]);
    const b = new TestClient(url, 'client-bbbb', [seat('Bruno', 'human')]);
    const c = new TestClient(url, 'client-cccc', [seat('Chloé', 'human')]);
    await a.open();
    await b.open();
    await c.open();

    // Lobby: roles follow preferences, first client hosts.
    const lob = await until(() => (c.lobby?.players.length === 3 ? c.lobby : null), 4000, 'lobby');
    expect(lob.hostId).toBe('client-aaaa');
    expect(lob.players.map((p) => p.role)).toEqual(['tofu', 'human', 'human']);
    expect(lob.ai).toEqual({ tofu: false, humans: 0 });

    // Only the host can change settings or start.
    b.send({ t: 'settings', settings: { duration: 900 } });
    b.send({ t: 'start' });
    b.send('garbage');
    b.send({ t: 'in', f: 'nope' });
    await sleep(150);
    expect(a.start).toBeNull();
    expect(a.lobby?.settings.duration).not.toBe(900);

    a.send({ t: 'settings', settings: { duration: 120, difficulty: 0, variant: 'pluie' } as never });
    await until(() => b.lobby?.settings.duration === 120, 2000, 'settings');
    expect(b.lobby?.settings.variant).toBe('ete');
    a.send({ t: 'settings', settings: { variant: 'hiver' } });
    await until(() => b.lobby?.settings.variant === 'hiver', 2000, 'ambiance');
    a.send({ t: 'start' });
    await until(() => a.start && b.start && c.start, 4000, 'start');
    expect(a.start!.you).toEqual([{ seat: 0, charId: 0 }]);
    expect(b.start!.you).toEqual([{ seat: 0, charId: 1 }]);
    expect(c.start!.you).toEqual([{ seat: 0, charId: 2 }]);
    expect(a.state!.chars.map((ch) => [ch.role, ch.name, ch.ai])).toEqual([
      ['tofu', 'Alice', false], ['human', 'Bruno', false], ['human', 'Chloé', false],
    ]);
    expect(a.start!.cfg.duration).toBe(120);
    // Winter: every client builds the same snowy world.
    expect(a.start!.cfg.variant).toBe('hiver');
    const snowman = a.state!.items.find((it) => it.id === 'bonhomme_jardin')!;
    expect(snowman.state).toBe('home');

    // Play: Bruno walks along -z (free corridor) for one second.
    await until(() => b.state?.phase === 'play', 3000, 'play phase');
    const z0 = b.state!.chars[1].z;
    const cz0 = b.state!.chars[2].z;
    await b.drive(60, 0, -1);
    await sleep(400);
    for (const cl of [a, b, c]) {
      expect(z0 - cl.state!.chars[1].z).toBeGreaterThan(2.5);
      expect(Math.abs(cl.state!.chars[2].z - cz0)).toBeLessThan(0.05);
    }
    // Every client mirrors the same authoritative state.
    await until(() => a.state!.tick === b.state!.tick && b.state!.tick === c.state!.tick, 2000, 'same tick');
    expect(a.state!.chars[1].x).toBe(c.state!.chars[1].x);
    expect(a.state!.chars[1].z).toBe(b.state!.chars[1].z);
    expect(b.ack[0]).toBe(b.seq);

    // Inputs for seats the client does not own are ignored.
    const tofuX = a.state!.chars[0].x;
    for (let i = 0; i < 20; i++) b.send({ t: 'in', f: [[1, 1000 + i, -1, 0, 0], [7, 1000 + i, -1, 0, 0]] });
    await sleep(300);
    expect(a.state!.chars[0].x).toBeCloseTo(tofuX, 3);

    // Disconnect: the computer takes over Chloé, the match keeps running.
    c.close();
    await until(() => a.state!.chars[2].ai, 3000, 'AI takeover');
    const tick = a.state!.tick;
    await sleep(200);
    expect(a.state!.tick).toBeGreaterThan(tick);

    // Reconnect with the same id: control comes back.
    const c2 = new TestClient(url, 'client-cccc', []);
    await c2.open();
    await until(() => c2.start, 3000, 'reattach');
    expect(c2.start!.you).toEqual([{ seat: 0, charId: 2 }]);
    await until(() => c2.state && !c2.state.chars[2].ai && a.state!.chars[2].ai === false, 3000, 'player back');
    await c2.drive(10, 0, 1);
    await until(() => c2.ack[0] === c2.seq, 2000, 'ack after reconnect');

    // End of match (forced), then a rematch with Tofu rotation.
    room.game!.state.chaos = room.game!.state.chaosGoal + 1;
    await until(() => a.state!.phase === 'end' && c2.state!.phase === 'end', 3000, 'end');
    expect(a.state!.winner).toBe('tofu');
    expect(a.state!.stats.tofuDistance).toBeGreaterThanOrEqual(0);
    b.send({ t: 'rematch', rotate: true });
    await sleep(150);
    expect(a.starts).toBe(1);
    a.send({ t: 'rematch', rotate: true });
    await until(() => a.starts === 2 && b.starts === 2 && c2.starts === 2, 3000, 'rematch');
    expect(b.start!.you).toEqual([{ seat: 0, charId: 0 }]);
    expect(b.state!.chars[0].name).toBe('Bruno');
    expect(a.start!.you[0].charId).not.toBe(0);

    // Back to the lobby (host only).
    a.send({ t: 'to_lobby' });
    await until(() => b.lobby?.phase === 'lobby', 2000, 'lobby again');
    a.close();
    b.close();
    c2.close();
    await until(() => room.clients.size === 0, 2000, 'room empty');
  }, 30000);

  it('handles extra players, spectators and bad clients', async () => {
    const cl = [1, 2, 3, 4].map((i) => new TestClient(url, `extra-${i}000`, [seat(`P${i}`, 'any')]));
    for (const x of cl) await x.open();
    const lob = await until(() => (cl[3].lobby?.players.length === 4 ? cl[3].lobby : null), 3000, 'lobby of 4');
    // Three active roles at most: the first "any" player becomes Tofu, the fourth waits.
    expect(lob.players.map((p) => p.role)).toEqual(['tofu', 'human', 'human', 'wait']);
    expect(lob.ai).toEqual({ tofu: false, humans: 0 });
    // The host makes P3 Tofu.
    cl[0].send({ t: 'assign', key: lob.players[2].key, role: 'tofu' });
    const lob2 = await until(() => (cl[0].lobby?.players[2].role === 'tofu' ? cl[0].lobby : null), 2000, 'assign');
    expect(lob2.players.map((p) => p.role)).toEqual(['human', 'human', 'tofu', 'wait']);
    // If everybody wants to be human, the computer plays Tofu.
    for (const x of cl) x.send({ t: 'seat', seat: 0, pref: 'human' });
    const lob3 = await until(() => (cl[0].lobby?.players.every((p) => p.pref === 'human') ? cl[0].lobby : null), 2000, 'prefs');
    expect(lob3.players.map((p) => p.role)).toEqual(['human', 'human', 'wait', 'wait']);
    expect(lob3.ai.tofu).toBe(true);
    cl[0].send({ t: 'assign', key: lob.players[2].key, role: 'tofu' });
    await until(() => cl[0].lobby?.players[2].role === 'tofu', 2000, 'assign again');
    cl[0].send({ t: 'start' });
    await until(() => cl.every((x) => x.start), 3000, 'start');
    expect(cl[3].start!.you).toEqual([]); // spectator
    expect(cl[2].start!.you).toEqual([{ seat: 0, charId: 0 }]);
    // A client flooding the server is cut off without hurting the others.
    const bad = new TestClient(url, 'flooder-01', [seat('Flood', 'any')]);
    await bad.open();
    for (let i = 0; i < 3500; i++) bad.send({ t: 'ping', c: i });
    await until(() => bad.closedCode !== 0, 3000, 'flooder closed');
    const t0 = cl[0].state!.tick;
    await sleep(200);
    expect(cl[0].state!.tick).toBeGreaterThan(t0);
    // Oversized frames are refused by the socket layer.
    const big = new TestClient(url, 'bigmsg-01', [seat('Big', 'any')]);
    await big.open();
    big.send('x'.repeat(70 * 1024));
    await until(() => big.closedCode !== 0, 3000, 'oversize closed');
    for (const x of cl) x.close();
  }, 20000);
});
