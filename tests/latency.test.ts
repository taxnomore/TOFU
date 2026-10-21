// Play over a slow, irregular Internet link: the real browser client code
// (NetClient + NetSession) talks to the real server through a relay that
// delays every message by 70 ms ± 30 ms each way.
import http from 'node:http';
import type { AddressInfo } from 'node:net';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { WebSocket, WebSocketServer } from 'ws';
import { CameraRig } from '../src/client/render/camera';
import { NetClient, StartMsg } from '../src/client/runtime/netClient';
import { NetSession } from '../src/client/runtime/netSession';
import type { LocalPlayer } from '../src/client/runtime/session';
import type { InputDevice, RawInput } from '../src/client/input/devices';
import { BTN_BARK } from '../src/shared/constants';
import type { GameEvent } from '../src/shared/sim/types';
import { sleep, startServer, until } from './netHelpers';

/** Forwards WebSocket messages after a random delay, keeping their order (like TCP). */
async function delayRelay(target: number, base: number, jitter: number) {
  const server = http.createServer();
  const wss = new WebSocketServer({ server });
  wss.on('connection', (down, req) => {
    const up = new WebSocket(`ws://127.0.0.1:${target}${req.url}`);
    /** One queue per direction, emptied in order by a single timer. */
    const pipe = (to: () => WebSocket) => {
      const q: { at: number; data: string }[] = [];
      let timer: ReturnType<typeof setTimeout> | null = null;
      const pump = () => {
        timer = null;
        while (q.length && q[0].at <= Date.now()) {
          const ws = to();
          const m = q.shift()!;
          if (ws.readyState === WebSocket.OPEN) ws.send(m.data);
        }
        if (q.length) timer = setTimeout(pump, Math.max(1, q[0].at - Date.now()));
      };
      return (data: string) => {
        const last = q.length ? q[q.length - 1].at : 0;
        q.push({ at: Math.max(last, Date.now() + base + (Math.random() * 2 - 1) * jitter), data });
        if (!timer) timer = setTimeout(pump, Math.max(1, q[0].at - Date.now()));
      };
    };
    const toServer = pipe(() => up);
    const toClient = pipe(() => down);
    const early: string[] = [];
    up.on('open', () => {
      for (const m of early.splice(0)) toServer(m);
    });
    down.on('message', (d) => (up.readyState === WebSocket.OPEN ? toServer(d.toString()) : early.push(d.toString())));
    up.on('message', (d) => toClient(d.toString()));
    up.on('close', (code) => down.close(code >= 4000 ? code : 1000));
    down.on('close', () => up.close());
    up.on('error', () => down.close());
  });
  await new Promise<void>((r) => server.listen(0, '127.0.0.1', () => r()));
  return {
    port: (server.address() as AddressInfo).port,
    close: async () => {
      for (const c of wss.clients) c.terminate();
      await new Promise((r) => server.close(r));
    },
  };
}

const idle = (): RawInput => ({ mx: 0, my: 0, yaw: 0, pitch: 0, zoom: 0, buttons: 0, pause: false, tactical: false });
const noDevice = { id: 'test', kind: 'keyboard', label: 'test', poll: idle, anyPressed: () => false } as InputDevice;

/** A player as the browser runs it: connection, prediction, 60 frames per second. */
class Player {
  net: NetClient;
  session: NetSession | null = null;
  lp: LocalPlayer | null = null;
  start: StartMsg | null = null;
  events: GameEvent[] = [];
  private timer: ReturnType<typeof setInterval> | null = null;

  constructor(url: string, name: string, pref: 'tofu' | 'human') {
    this.net = new NetClient([{ name, avatar: 0, pref, device: 'keyboard' }], url);
    this.net.onStart = (m) => (this.start = m);
    this.net.connect();
  }

  /** Builds the game view and runs it every 16 ms, like requestAnimationFrame. */
  play() {
    const m = this.start!;
    this.lp = { slot: 0, charId: m.you[0].charId, seat: 0, device: noDevice, rig: new CameraRig(), rect: { x: 0, y: 0, w: 1, h: 1 }, raw: idle(), name: 'test' };
    this.session = new NetSession(this.net, m, [this.lp]);
    let last = performance.now();
    this.timer = setInterval(() => {
      const now = performance.now();
      this.session!.update((now - last) / 1000);
      last = now;
      for (const e of this.session!.drainEvents()) this.events.push(e);
    }, 16);
  }

  /** Character as shown on this screen. */
  me() {
    return this.session!.state.chars[this.lp!.charId];
  }

  stop() {
    if (this.timer) clearInterval(this.timer);
    this.session?.dispose();
    this.net.close();
  }
}

let srv: Awaited<ReturnType<typeof startServer>>;
let relay: Awaited<ReturnType<typeof delayRelay>>;

beforeAll(async () => {
  srv = await startServer({ mode: 'internet', room: { countdown: 0.2 } });
  relay = await delayRelay(srv.port, 70, 30);
});

afterAll(async () => {
  await relay.close();
  await srv.close();
});

describe('Internet latency (70 ms ± 30 ms each way)', () => {
  it('own character answers at once, ends where the server says, and brief presses get through', async () => {
    // Tofu plays far away (slow link), the human sits next to the server.
    const far = new Player(`ws://127.0.0.1:${relay.port}/ws?salon=new`, 'Loin', 'tofu');
    await until(() => far.net.room && far.net.lobby, 5000, 'room created through the relay');
    const near = new Player(srv.url(far.net.room), 'Près', 'human');
    await until(() => far.net.lobby?.players.length === 2, 5000, 'both in the lobby');
    far.net.send({ t: 'start' });
    await until(() => far.start && near.start, 5000, 'start');
    far.play();
    near.play();
    const room = srv.manager.rooms.get(far.net.room)!;
    await until(() => room.game?.state.phase === 'play', 5000, 'play phase');
    await sleep(300);
    const server = () => room.game!.state.chars[far.lp!.charId];

    // Walk: the screen moves long before the server has even heard of it.
    const x0 = far.me().x;
    const z0 = far.me().z;
    const t0 = performance.now();
    let tScreen = 0;
    let tServer = 0;
    far.lp!.raw = { ...idle(), my: 1 };
    while ((!tScreen || !tServer) && performance.now() - t0 < 2000) {
      await sleep(3);
      const t = performance.now() - t0;
      if (!tScreen && Math.hypot(far.me().x - x0, far.me().z - z0) > 0.05) tScreen = t;
      if (!tServer && Math.hypot(server().x - x0, server().z - z0) > 0.05) tServer = t;
    }
    expect(tScreen).toBeGreaterThan(0);
    expect(tScreen + 30).toBeLessThan(tServer);
    // Corrections stay small while walking with a jittery link.
    let worst = 0;
    for (let i = 0; i < 60; i++) {
      await sleep(20);
      const p = (far.session as unknown as { preds: { errX: number; errZ: number }[] }).preds[0];
      worst = Math.max(worst, Math.hypot(p.errX, p.errZ));
    }
    far.lp!.raw = idle();
    await sleep(700);
    // After stopping, the screen and the server agree.
    expect(Math.hypot(far.me().x - server().x, far.me().z - server().z)).toBeLessThan(0.05);
    expect(Math.hypot(server().x - x0, server().z - z0)).toBeGreaterThan(1);
    expect(worst).toBeLessThan(0.25);

    // A bark pressed for a single frame still reaches the server's simulation and
    // the other player. Far from the cat: a swipe of its paw would stun Tofu.
    const g = room.game!;
    let applied = false;
    const step = g.step.bind(g);
    g.step = (inputs) => {
      if ((inputs[far.lp!.charId]?.buttons ?? 0) & BTN_BARK) applied = true;
      step(inputs);
    };
    const free = () => server().stun <= 0 && !server().lureKind && server().barkCd <= 0 && Math.hypot(g.state.cat.x - server().x, g.state.cat.z - server().z) > 4;
    await until(free, 10000, 'Tofu free to bark, away from the cat');
    const barks = g.state.stats.barks;
    const sent = () => (far.session as unknown as { seq: number }).seq;
    const before = sent();
    far.lp!.raw = { ...idle(), buttons: BTN_BARK };
    await until(() => sent() > before, 1000, 'one frame sent');
    far.lp!.raw = idle();
    await until(() => applied, 6000, 'the single-frame press reaches the server simulation');
    await until(() => g.state.stats.barks > barks, 3000, 'bark applied by the server');
    await until(() => near.events.some((e) => e.t === 'bark'), 6000, 'bark seen by the other player');

    // The jittery link gets a longer render delay than the direct one.
    expect(far.session!.renderDelay).toBeGreaterThan(near.session!.renderDelay);
    expect(near.session!.renderDelay).toBeLessThan(0.12);
    expect(far.net.rtt).toBeGreaterThan(100);

    far.stop();
    near.stop();
  }, 30000);
});
